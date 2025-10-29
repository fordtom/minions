const std = @import("std");
const sqlite = @cImport({
    @cInclude("sqlite3.h");
});

pub const Process = struct {
    id: i64,
    flake_url: []const u8,
    env_vars: ?[]const u8,
    args: ?[]const u8,
    allocator: std.mem.Allocator,

    pub fn deinit(self: *Process) void {
        self.allocator.free(self.flake_url);
        if (self.env_vars) |ev| self.allocator.free(ev);
        if (self.args) |a| self.allocator.free(a);
    }
};

pub const ProcessState = struct {
    process_id: i64,
    pid: ?i32,
    status: Status,
};

pub const Status = enum {
    STOPPED,
    RUNNING,
};

pub const DbError = error{
    DatabaseOpenFailed,
    DatabaseCloseFailed,
    DatabaseExecuteFailed,
};

pub const Database = struct {
    db: *sqlite.sqlite3,

    pub fn init(path: [:0]const u8) DbError!Database {
        var db: ?*sqlite.sqlite3 = null;
        const result = sqlite.sqlite3_open(path.ptr, &db);

        if (result != sqlite.SQLITE_OK) {
            return DbError.DatabaseOpenFailed;
        }

        const fk_result = sqlite.sqlite3_exec(db, "PRAGMA foreign_keys = ON", null, null, null);
        if (fk_result != sqlite.SQLITE_OK) {
            _ = sqlite.sqlite3_close(db.?);
            return DbError.DatabaseExecuteFailed;
        }

        return Database{ .db = db.? };
    }

    pub fn deinit(self: *Database) DbError!void {
        const result = sqlite.sqlite3_close(self.db);
        if (result != sqlite.SQLITE_OK) {
            return self.sqliteError(DbError.DatabaseCloseFailed);
        }
    }

    pub fn initSchema(self: *Database) DbError!void {
        const schema =
            \\CREATE TABLE IF NOT EXISTS processes (
            \\    id INTEGER PRIMARY KEY AUTOINCREMENT,
            \\    flake_url TEXT NOT NULL,
            \\    env_vars TEXT,
            \\    args TEXT
            \\);
            \\
            \\CREATE TABLE IF NOT EXISTS process_state (
            \\    process_id INTEGER PRIMARY KEY,
            \\    pid INTEGER,
            \\    status TEXT NOT NULL,
            \\    FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE
            \\);
        ;

        const result = sqlite.sqlite3_exec(self.db, schema.ptr, null, null, null);

        if (result != sqlite.SQLITE_OK) {
            return self.sqliteError(DbError.DatabaseExecuteFailed);
        }
    }

    pub fn createProcess(self: *Database, flake_url: []const u8, env_vars: ?[]const u8, args: ?[]const u8) DbError!i64 {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "INSERT INTO processes (flake_url, env_vars, args) VALUES (?, ?, ?)";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_text(stmt, 1, flake_url.ptr, @intCast(flake_url.len), null));

        if (env_vars) |ev| {
            try self.checkOk(sqlite.sqlite3_bind_text(stmt, 2, ev.ptr, @intCast(ev.len), null));
        } else {
            try self.checkOk(sqlite.sqlite3_bind_null(stmt, 2));
        }

        if (args) |a| {
            try self.checkOk(sqlite.sqlite3_bind_text(stmt, 3, a.ptr, @intCast(a.len), null));
        } else {
            try self.checkOk(sqlite.sqlite3_bind_null(stmt, 3));
        }

        try self.checkDone(sqlite.sqlite3_step(stmt));
        const id = sqlite.sqlite3_last_insert_rowid(self.db);
        return @intCast(id);
    }

    pub fn getProcess(self: *Database, allocator: std.mem.Allocator, id: i64) !?Process {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "SELECT id, flake_url, env_vars, args FROM processes WHERE id = ?";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_int64(stmt, 1, id));

        const result = sqlite.sqlite3_step(stmt);
        if (result != sqlite.SQLITE_ROW) {
            return if (result == sqlite.SQLITE_DONE) null else self.sqliteError(DbError.DatabaseExecuteFailed);
        }

        const process_id = sqlite.sqlite3_column_int64(stmt, 0);
        const flake_url_ptr = sqlite.sqlite3_column_text(stmt, 1);
        const env_vars_ptr = sqlite.sqlite3_column_text(stmt, 2);
        const args_ptr = sqlite.sqlite3_column_text(stmt, 3);

        const flake_url = try allocator.dupe(u8, std.mem.span(flake_url_ptr));
        const env_vars = if (env_vars_ptr) |ev| try allocator.dupe(u8, std.mem.span(ev)) else null;
        const args = if (args_ptr) |a| try allocator.dupe(u8, std.mem.span(a)) else null;

        return Process{
            .id = process_id,
            .flake_url = flake_url,
            .env_vars = env_vars,
            .args = args,
            .allocator = allocator,
        };
    }

    pub fn updateProcess(self: *Database, id: i64, flake_url: []const u8, env_vars: ?[]const u8, args: ?[]const u8) DbError!void {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "UPDATE processes SET flake_url = ?, env_vars = ?, args = ? WHERE id = ?";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_text(stmt, 1, flake_url.ptr, @intCast(flake_url.len), null));

        if (env_vars) |ev| {
            try self.checkOk(sqlite.sqlite3_bind_text(stmt, 2, ev.ptr, @intCast(ev.len), null));
        } else {
            try self.checkOk(sqlite.sqlite3_bind_null(stmt, 2));
        }

        if (args) |a| {
            try self.checkOk(sqlite.sqlite3_bind_text(stmt, 3, a.ptr, @intCast(a.len), null));
        } else {
            try self.checkOk(sqlite.sqlite3_bind_null(stmt, 3));
        }

        try self.checkOk(sqlite.sqlite3_bind_int64(stmt, 4, id));
        try self.checkDone(sqlite.sqlite3_step(stmt));
    }

    pub fn deleteProcess(self: *Database, id: i64) DbError!void {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "DELETE FROM processes WHERE id = ?";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_int64(stmt, 1, id));
        try self.checkDone(sqlite.sqlite3_step(stmt));
    }

    pub fn listProcesses(self: *Database, allocator: std.mem.Allocator) ![]Process {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "SELECT id, flake_url, env_vars, args FROM processes";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        var list = std.ArrayList(Process){};
        errdefer {
            for (list.items) |*p| p.deinit();
            list.deinit(allocator);
        }

        while (true) {
            const result = sqlite.sqlite3_step(stmt);
            if (result == sqlite.SQLITE_DONE) break;
            if (result != sqlite.SQLITE_ROW) {
                return self.sqliteError(DbError.DatabaseExecuteFailed);
            }

            const id = sqlite.sqlite3_column_int64(stmt, 0);
            const flake_url_ptr = sqlite.sqlite3_column_text(stmt, 1);
            const env_vars_ptr = sqlite.sqlite3_column_text(stmt, 2);
            const args_ptr = sqlite.sqlite3_column_text(stmt, 3);

            const flake_url = try allocator.dupe(u8, std.mem.span(flake_url_ptr));
            const env_vars = if (env_vars_ptr) |ev| try allocator.dupe(u8, std.mem.span(ev)) else null;
            const args = if (args_ptr) |a| try allocator.dupe(u8, std.mem.span(a)) else null;

            try list.append(allocator, Process{
                .id = id,
                .flake_url = flake_url,
                .env_vars = env_vars,
                .args = args,
                .allocator = allocator,
            });
        }

        return try list.toOwnedSlice(allocator);
    }

    pub fn upsertProcessState(self: *Database, process_id: i64, pid: ?i32, status: Status) DbError!void {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "INSERT OR REPLACE INTO process_state (process_id, pid, status) VALUES (?, ?, ?)";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_int64(stmt, 1, process_id));

        if (pid) |p| {
            try self.checkOk(sqlite.sqlite3_bind_int(stmt, 2, p));
        } else {
            try self.checkOk(sqlite.sqlite3_bind_null(stmt, 2));
        }

        const status_str = @tagName(status);
        try self.checkOk(sqlite.sqlite3_bind_text(stmt, 3, status_str.ptr, @intCast(status_str.len), null));
        try self.checkDone(sqlite.sqlite3_step(stmt));
    }

    pub fn getProcessState(self: *Database, process_id: i64) !?ProcessState {
        var stmt: ?*sqlite.sqlite3_stmt = null;
        const sql = "SELECT process_id, pid, status FROM process_state WHERE process_id = ?";

        try self.checkOk(sqlite.sqlite3_prepare_v2(self.db, sql.ptr, @intCast(sql.len), &stmt, null));
        defer _ = sqlite.sqlite3_finalize(stmt);

        try self.checkOk(sqlite.sqlite3_bind_int64(stmt, 1, process_id));

        const result = sqlite.sqlite3_step(stmt);
        if (result != sqlite.SQLITE_ROW) {
            return if (result == sqlite.SQLITE_DONE) null else self.sqliteError(DbError.DatabaseExecuteFailed);
        }

        const pid_type = sqlite.sqlite3_column_type(stmt, 1);
        const pid: ?i32 = if (pid_type == sqlite.SQLITE_NULL) null else @intCast(sqlite.sqlite3_column_int(stmt, 1));
        const status_ptr = sqlite.sqlite3_column_text(stmt, 2);
        const status = std.meta.stringToEnum(Status, std.mem.span(status_ptr));

        if (status == null) {
            return self.sqliteError(DbError.DatabaseExecuteFailed);
        }

        return ProcessState{
            .process_id = process_id,
            .pid = pid,
            .status = status.?,
        };
    }

    fn sqliteError(self: *Database, comptime err: DbError) DbError {
        const err_msg = sqlite.sqlite3_errmsg(self.db);
        std.debug.print("SQLite error: {s}\n", .{err_msg});
        return err;
    }

    fn checkOk(self: *Database, result: c_int) DbError!void {
        if (result != sqlite.SQLITE_OK) {
            return self.sqliteError(DbError.DatabaseExecuteFailed);
        }
    }

    fn checkDone(self: *Database, result: c_int) DbError!void {
        if (result != sqlite.SQLITE_DONE) {
            return self.sqliteError(DbError.DatabaseExecuteFailed);
        }
    }

    fn checkRow(self: *Database, result: c_int) DbError!void {
        if (result != sqlite.SQLITE_ROW) {
            return self.sqliteError(DbError.DatabaseExecuteFailed);
        }
    }
};

test "sqlite linking" {
    const version = sqlite.sqlite3_libversion();
    std.debug.print("SQLite version: {s}\n", .{version});
    try std.testing.expect(version != null);
}

test "database init and deinit" {
    var db = try Database.init("test.db");
    defer {
        db.deinit() catch {};
        std.fs.cwd().deleteFile("test.db") catch {};
    }
    try db.initSchema();
}

test "database create process" {
    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    const id2 = try db.createProcess("github:fordtom/minions#test", "FOO=BAR", "--help");
    try std.testing.expectEqual(@as(i64, 2), id2);
}

test "database get process" {
    const allocator = std.testing.allocator;

    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    var process = try db.getProcess(allocator, id);
    try std.testing.expect(process != null);
    defer process.?.deinit();

    try std.testing.expectEqual(@as(i64, 1), process.?.id);
    try std.testing.expectEqualStrings("github:user/repo#app", process.?.flake_url);
    try std.testing.expect(process.?.env_vars == null);
    try std.testing.expect(process.?.args == null);

    const missing = try db.getProcess(allocator, 999);
    try std.testing.expect(missing == null);
}

test "database update process" {
    const allocator = std.testing.allocator;

    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    var process = try db.getProcess(allocator, id);
    try std.testing.expect(process != null);
    defer process.?.deinit();

    try std.testing.expectEqual(@as(i64, 1), process.?.id);
    try std.testing.expectEqualStrings("github:user/repo#app", process.?.flake_url);
    try std.testing.expect(process.?.env_vars == null);
    try std.testing.expect(process.?.args == null);

    try db.updateProcess(id, "github:user/repo#app", "FOO=BAR", "--help");

    var process_updated = try db.getProcess(allocator, id);
    try std.testing.expect(process_updated != null);
    defer process_updated.?.deinit();

    try std.testing.expectEqual(@as(i64, 1), process_updated.?.id);
    try std.testing.expectEqualStrings("github:user/repo#app", process_updated.?.flake_url);
    try std.testing.expectEqualStrings("FOO=BAR", process_updated.?.env_vars.?);
    try std.testing.expectEqualStrings("--help", process_updated.?.args.?);
}

test "database delete process" {
    const allocator = std.testing.allocator;

    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    var process = try db.getProcess(allocator, id);
    try std.testing.expect(process != null);
    defer process.?.deinit();

    try std.testing.expectEqual(@as(i64, 1), process.?.id);
    try std.testing.expectEqualStrings("github:user/repo#app", process.?.flake_url);
    try std.testing.expect(process.?.env_vars == null);
    try std.testing.expect(process.?.args == null);

    try db.deleteProcess(id);

    const missing = try db.getProcess(allocator, id);
    try std.testing.expect(missing == null);
}

test "database list processes" {
    const allocator = std.testing.allocator;

    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    const id2 = try db.createProcess("github:fordtom/minions#test", "FOO=BAR", "--help");
    try std.testing.expectEqual(@as(i64, 2), id2);

    const processes = try db.listProcesses(allocator);
    try std.testing.expectEqual(@as(usize, 2), processes.len);
    defer {
        for (processes) |*p| p.deinit();
        allocator.free(processes);
    }

    try std.testing.expectEqual(@as(i64, 1), processes[0].id);
    try std.testing.expectEqualStrings("github:user/repo#app", processes[0].flake_url);
    try std.testing.expect(processes[0].env_vars == null);
    try std.testing.expect(processes[0].args == null);

    try std.testing.expectEqual(@as(i64, 2), processes[1].id);
    try std.testing.expectEqualStrings("github:fordtom/minions#test", processes[1].flake_url);
    try std.testing.expectEqualStrings("FOO=BAR", processes[1].env_vars.?);
    try std.testing.expectEqualStrings("--help", processes[1].args.?);
}

test "database upsert and get process state" {
    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    try db.upsertProcessState(id, 123, .RUNNING);

    const state = try db.getProcessState(id);
    try std.testing.expect(state != null);

    try std.testing.expectEqual(@as(i64, 1), state.?.process_id);
    try std.testing.expectEqual(@as(i32, 123), state.?.pid);
    try std.testing.expectEqual(.RUNNING, state.?.status);

    try db.upsertProcessState(id, 456, .STOPPED);

    const state_updated = try db.getProcessState(id);
    try std.testing.expect(state_updated != null);

    try std.testing.expectEqual(@as(i64, 1), state_updated.?.process_id);
    try std.testing.expectEqual(@as(i32, 456), state_updated.?.pid);
    try std.testing.expectEqual(.STOPPED, state_updated.?.status);

    const state_missing = try db.getProcessState(999);
    try std.testing.expect(state_missing == null);
}

test "database cascade delete process state" {
    var db = try Database.init(":memory:");
    defer db.deinit() catch {};
    try db.initSchema();

    const id = try db.createProcess("github:user/repo#app", null, null);
    try std.testing.expectEqual(@as(i64, 1), id);

    try db.upsertProcessState(id, 123, .RUNNING);

    const state = try db.getProcessState(id);
    try std.testing.expect(state != null);

    try db.deleteProcess(id);

    const state_missing = try db.getProcessState(id);
    try std.testing.expect(state_missing == null);
}
