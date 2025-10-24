const std = @import("std");
const minions = @import("minions");

pub fn main() !void {
    try minions.server.serve();
}
