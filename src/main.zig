const std = @import("std");
const minions = @import("minions");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    try minions.server.serve(allocator, "public", 3000);
}
