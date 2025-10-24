const std = @import("std");

const ContentType = enum {
    html,
    css,
    javascript,
    json,
    plain,

    fn header(self: ContentType) std.http.Header {
        return switch (self) {
            .html => std.http.Header{ .name = "content-type", .value = "text/html" },
            .css => std.http.Header{ .name = "content-type", .value = "text/css" },
            .javascript => std.http.Header{ .name = "content-type", .value = "application/javascript" },
            .json => std.http.Header{ .name = "content-type", .value = "application/json" },
            .plain => std.http.Header{ .name = "content-type", .value = "text/plain" },
        };
    }

    fn fromPath(path: []const u8) ContentType {
        if (std.mem.endsWith(u8, path, ".html")) return .html;
        if (std.mem.endsWith(u8, path, ".css")) return .css;
        if (std.mem.endsWith(u8, path, ".js")) return .javascript;
        if (std.mem.endsWith(u8, path, ".json")) return .json;
        return .plain;
    }
};

fn resolvePath(allocator: std.mem.Allocator, root_path: []const u8, path: []const u8) ?[]u8 {
    const clean_request = if (path.len > 0 and path[0] == '/') path[1..] else path;
    const file_path = if (clean_request.len == 0) "index.html" else clean_request;

    if (std.mem.indexOf(u8, file_path, "..")) |_| {
        return null;
    }

    return std.fs.path.join(allocator, &[_][]const u8{ root_path, file_path }) catch {
        return null;
    };
}

fn readFile(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();
    const file_size = (try file.stat()).size;
    return try file.readToEndAlloc(allocator, file_size);
}

fn replaceInTemplate(
    allocator: std.mem.Allocator,
    template: []const u8,
    placeholder: []const u8,
    content: []const u8,
) ![]u8 {
    return std.mem.replaceOwned(u8, allocator, template, placeholder, content);
}

pub fn serve(allocator: std.mem.Allocator, root_path: []const u8, port: u16) !void {
    const address = try std.net.Address.parseIp("127.0.0.1", port);

    var listener = try address.listen(.{ .reuse_address = true });
    defer listener.deinit();

    std.debug.print("listening on 127.0.0.1:{d}", .{port});

    while (true) {
        var connection = try listener.accept();
        defer connection.stream.close();

        std.debug.print("\nnew connection\n", .{});

        var read_buffer: [4096]u8 = undefined;
        var write_buffer: [4096]u8 = undefined;

        var reader = connection.stream.reader(&read_buffer);
        var writer = connection.stream.writer(&write_buffer);

        var http_server = std.http.Server.init(reader.interface(), &writer.interface);

        var request = http_server.receiveHead() catch {
            continue;
        };

        std.debug.print("Method: {s}\n", .{@tagName(request.head.method)});
        std.debug.print("Target: {s}\n", .{request.head.target});

        // Get our path, should it exist
        const path = resolvePath(allocator, root_path, request.head.target);

        // We go in while it's a valid path
        if (path) |p| valid: {
            defer allocator.free(p);
            const content_type = ContentType.fromPath(p);

            const body = readFile(allocator, p) catch {
                // Break the valid block and return 404
                break :valid;
            };
            defer allocator.free(body);

            // Return the page
            try request.respond(body, .{ .status = .ok, .extra_headers = &.{content_type.header()} });
            continue;
        }

        try request.respond("404 Not Found", .{ .status = .not_found, .extra_headers = &.{ContentType.html.header()} });
    }
}
