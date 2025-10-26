const std = @import("std");
const utils = @import("utils.zig");

pub fn installNoZombieReaper() void {
    var act = std.posix.Sigaction{
        .handler = .{ .handler = std.posix.SIG.IGN },
        .mask = std.posix.sigemptyset(),
        .flags = std.posix.SA.NOCLDWAIT,
    };
    std.posix.sigaction(std.posix.SIG.CHLD, &act, null);
}

pub fn runFlake(allocator: std.mem.Allocator, flake_url: []const u8, env_vars: []const u8, args: []const u8) !i32 {
    var argv = std.ArrayList([]const u8){};
    defer argv.deinit(allocator);

    try argv.appendSlice(allocator, &.{ "nix", "run", flake_url, "--" });

    // handle args
    var args_iter = std.mem.tokenizeAny(u8, args, " \t");
    while (args_iter.next()) |arg| {
        try argv.append(allocator, arg);
    }

    var child = std.process.Child.init(argv.items, allocator);
    child.stdin_behavior = .Ignore;
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;

    var env_map = try std.process.getEnvMap(allocator);
    defer env_map.deinit();

    var env_pairs = try utils.parseDotEnv(allocator, env_vars);
    defer env_pairs.deinit();

    var env_iter = env_pairs.iterator();
    while (env_iter.next()) |entry| {
        try env_map.put(entry.key_ptr.*, entry.value_ptr.*);
    }
    child.env_map = &env_map;

    try child.spawn();

    return @intCast(child.id);
}

pub fn killFlake(pid: i32) !void {
    try std.posix.kill(pid, std.posix.SIG.TERM);
}

pub fn isFlakeRunning(pid: i32) bool {
    std.posix.kill(pid, 0) catch {
        return false;
    };
    return true;
}

test "run test flake" {
    installNoZombieReaper();

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const flake_url = "github:fordtom/minions#test";
    const env_vars = "TEST_VAR=foo\nCUSTOM_VAR=bar";
    const args = "arg1 arg2";

    const pid = try runFlake(allocator, flake_url, env_vars, args);
    try std.testing.expect(pid > 0);

    std.debug.print("PID: {}\n", .{pid});

    std.Thread.sleep(2_000 * std.time.ns_per_ms);

    try std.testing.expect(isFlakeRunning(pid));

    try killFlake(pid);

    std.Thread.sleep(1_000 * std.time.ns_per_ms);

    try std.testing.expect(!isFlakeRunning(pid));
}
