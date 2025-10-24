const std = @import("std");

pub fn serve() !void {
    const address = try std.net.Address.parseIp("127.0.0.1", 3000);

    var listener = try address.listen(.{ .reuse_address = true });
    defer listener.deinit();

    std.debug.print("listening on 127.0.0.1:3000", .{});

    while (true) {
        var connection = try listener.accept();
        defer connection.stream.close();

        std.debug.print("\nnew connection\n", .{});

        var read_buffer: [4096]u8 = undefined;
        var write_buffer: [4096]u8 = undefined;

        var reader = connection.stream.reader(&read_buffer);
        var writer = connection.stream.writer(&write_buffer);

        var http_server = std.http.Server.init(reader.interface(), &writer.interface);

        var request = http_server.receiveHead() catch |err| switch (err) {
            std.http.Reader.HeadError.HttpConnectionClosing => break,
            else => return err,
        };

        std.debug.print("Method: {s}\n", .{@tagName(request.head.method)});
        std.debug.print("Target: {s}\n", .{request.head.target});

        const body = "<h1>Hola from Zig</h1>";
        try request.respond(body, .{ .status = .ok, .extra_headers = &.{.{ .name = "content-type", .value = "text/html" }} });
    }
}
