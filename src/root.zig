const std = @import("std");
pub const db = @import("db.zig");
pub const nix = @import("nix.zig");
pub const utils = @import("utils.zig");

pub fn route(
    request: *std.http.Server.Request,
    database: *db.Database,
    allocator: std.mem.Allocator,
) !void {
    const method = request.head.method;
    const target = request.head.target;

    // GET /
    if (method == .GET and std.mem.eql(u8, target, "/")) {
        return handleOverview(request, database, allocator);
    }

    // GET /edit or /edit?id=123
    if (method == .GET and std.mem.startsWith(u8, target, "/edit")) {
        const id_str = utils.getQueryParam(target, "id");
        return handleEdit(request, database, allocator, id_str);
    }

    // POST /api/start/{id}
    if (method == .POST and std.mem.startsWith(u8, target, "/api/start/")) {
        const id_str = target["/api/start/".len..];
        return handleStart(request, database, allocator, id_str);
    }

    // POST /api/stop/{id}
    if (method == .POST and std.mem.startsWith(u8, target, "/api/stop/")) {
        const id_str = target["/api/stop/".len..];
        return handleStop(request, database, id_str);
    }

    // POST /api/delete/{id}
    if (method == .POST and std.mem.startsWith(u8, target, "/api/delete/")) {
        const id_str = target["/api/delete/".len..];
        return handleDelete(request, database, id_str);
    }

    // POST /api/save (create or update)
    if (method == .POST and std.mem.startsWith(u8, target, "/api/save/")) {
        const id_str = target["/api/save/".len..];
        return handleSave(request, database, allocator, id_str);
    }

    // 404 - just redirect to /
    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

fn handleOverview(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator) !void {
    const template = try utils.readFile(allocator, "public/index.html");

    const process_list = try database.listProcesses(allocator);
    defer {
        for (process_list) |*p| p.deinit();
        allocator.free(process_list);
    }

    // initialise some buffer to store the generated html text in?
    var rows = std.ArrayList(u8){};
    const writer = rows.writer(allocator);

    for (process_list) |p| {
        const state = try database.getProcessState(p.id);
        var alive = false;

        if (state.?.status == .running) {
            if (state.?.pid) |pid| {
                alive = nix.isFlakeRunning(pid);
            }
        }

        try writer.print(
            \\        <tr>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>
            \\                <form action="/edit" method="GET" style="display:inline;">
            \\                    <input type="hidden" name="id" value="{d}">
            \\                    <button>✏️</button>
            \\                </form>
        , .{ p.flake_url, p.args orelse "", p.env_vars orelse "", state.?.status.toString(), p.id });

        if (alive) {
            try writer.print(
                \\                <form action="/api/stop/{d}" method="POST" style="display:inline;">
                \\                    <button>⏹️</button>
                \\                </form>
            , .{p.id});
        } else {
            try writer.print(
                \\                <form action="/api/start/{d}" method="POST" style="display:inline;">
                \\                    <button>▶️</button>
                \\                </form>
            , .{p.id});
        }

        try writer.print(
            \\                <form action="/api/delete/{d}" method="POST" style="display:inline;">
            \\                    <button>🗑️</button>
            \\                </form>
            \\            </td>
            \\        </tr>
            \\
        , .{p.id});
    }

    const output = try std.mem.replaceOwned(u8, allocator, template, "{{PROCESS_ROWS}}", rows.items);
    try request.respond(output, .{ .status = .ok, .extra_headers = &.{utils.CONTENT_TYPE_HTML} });
}

fn handleEdit(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator, id_str: ?[]const u8) !void {
    var template = try utils.readFile(allocator, "public/edit.html");

    if (id_str) |id| {
        const id_int = try std.fmt.parseInt(i64, id, 10);
        const process = try database.getProcess(allocator, id_int);
        if (process) |p| {
            template = try std.mem.replaceOwned(u8, allocator, template, "{{PROCESS_ID}}", id);
            template = try std.mem.replaceOwned(u8, allocator, template, "{{FLAKE_URL}}", p.flake_url);
            template = try std.mem.replaceOwned(u8, allocator, template, "{{ENV_VARS}}", p.env_vars orelse "");
            template = try std.mem.replaceOwned(u8, allocator, template, "{{ARGS}}", p.args orelse "");
        }
    } else {
        template = try std.mem.replaceOwned(u8, allocator, template, "{{PROCESS_ID}}", "new");
        template = try std.mem.replaceOwned(u8, allocator, template, "{{FLAKE_URL}}", "");
        template = try std.mem.replaceOwned(u8, allocator, template, "{{ENV_VARS}}", "");
        template = try std.mem.replaceOwned(u8, allocator, template, "{{ARGS}}", "");
    }

    try request.respond(template, .{ .status = .ok, .extra_headers = &.{utils.CONTENT_TYPE_HTML} });
}

fn handleStart(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator, id_str: []const u8) !void {
    const id_int = try std.fmt.parseInt(i64, id_str, 10);
    const process = try database.getProcess(allocator, id_int);
    const processState = try database.getProcessState(id_int);
    if (processState) |state| {
        if (state.status == .stopped) {
            const pid = try nix.runFlake(allocator, process.?.flake_url, process.?.env_vars orelse "", process.?.args orelse "");
            try database.upsertProcessState(id_int, pid, .running);
        }
    }

    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

fn handleStop(request: *std.http.Server.Request, database: *db.Database, id_str: []const u8) !void {
    const id_int = try std.fmt.parseInt(i64, id_str, 10);
    const processState = try database.getProcessState(id_int);
    if (processState) |state| {
        if (state.status == .running) {
            try nix.killFlake(state.pid.?);
            try database.upsertProcessState(id_int, null, .stopped);
        }
    }

    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

fn handleDelete(request: *std.http.Server.Request, database: *db.Database, id_str: []const u8) !void {
    const id_int = try std.fmt.parseInt(i64, id_str, 10);
    const processState = try database.getProcessState(id_int);
    if (processState) |state| {
        if (state.status == .running) {
            try nix.killFlake(state.pid.?);
        }
    }
    try database.deleteProcess(id_int);

    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

fn handleSave(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator, id_str: []const u8) !void {
    var read_buf: [4096]u8 = undefined;
    const reader = request.readerExpectNone(&read_buf);
    const body = try reader.readAlloc(allocator, request.head.content_length orelse return error.NoContentLength);

    var params = try utils.parseKeyValuePairs(allocator, body);

    const flake_url = params.get("flake_url") orelse return error.MissingFlakeUrl;
    const env_vars = params.get("env_vars");
    const args = params.get("args");

    if (std.mem.eql(u8, id_str, "new")) {
        const id_int = try database.createProcess(flake_url, env_vars, args);
        try database.upsertProcessState(id_int, null, .stopped);
    } else {
        const id_int = try std.fmt.parseInt(i64, id_str, 10);
        try database.upsertProcessState(id_int, null, .stopped);
        try database.updateProcess(id_int, flake_url, env_vars, args);
    }

    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

test {
    std.testing.refAllDecls(@This());
}
