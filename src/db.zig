const std = @import("std");
const sqlite = @cImport({
    @cInclude("sqlite3.h");
});

test "sqlite linking" {
    const version = sqlite.sqlite3_libversion();
    std.debug.print("SQLite version: {s}\n", .{version});
    try std.testing.expect(version != null);
}
