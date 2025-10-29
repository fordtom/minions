const std = @import("std");
const minions = @import("minions");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const address = try std.net.Address.parseIp("127.0.0.1", 3000);

    var listener = try address.listen(.{ .reuse_address = true });
    defer listener.deinit();

    var database = try minions.db.Database.init("minions.db");
    defer database.deinit() catch {};
    try database.initSchema();

    while (true) {
        var connection = try listener.accept();
        defer connection.stream.close();

        var read_buf: [4096]u8 = undefined;
        var write_buff: [4096]u8 = undefined;

        var reader = connection.stream.reader(&read_buf);
        var writer = connection.stream.writer(&write_buff);

        var httpserver = std.http.Server.init(reader.interface(), &writer.interface);

        var request = httpserver.receiveHead() catch {
            continue;
        };

        var arena = std.heap.ArenaAllocator.init(allocator);
        defer arena.deinit();
        const request_allocator = arena.allocator();

        minions.route(&request, &database, request_allocator) catch |err| {
            std.debug.print("error: {s}\n", .{@errorName(err)});
            continue;
        };
    }
}
