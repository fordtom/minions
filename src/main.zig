const std = @import("std");
const minions = @import("minions");

pub fn main() !void {
    std.debug.print("All your {s} are belong to us.\n", .{"codebase"});
}
