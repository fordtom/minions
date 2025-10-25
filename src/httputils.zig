const std = @import("std");

pub const CONTENT_TYPE_HTML = std.http.Header{ .name = "content-type", .value = "text/html" };

pub fn readFile(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();
    const file_size = (try file.stat()).size;
    return try file.readToEndAlloc(allocator, file_size);
}

pub fn parseKeyValuePairs(allocator: std.mem.Allocator, query_string: []const u8) !std.StringHashMap([]const u8) {
    var params = std.StringHashMap([]const u8).init(allocator);
    errdefer {
        var iter = params.iterator();
        while (iter.next()) |entry| {
            allocator.free(entry.key_ptr.*);
            allocator.free(entry.value_ptr.*);
        }
        params.deinit();
    }

    var pairs = std.mem.split(u8, query_string, "&");
    while (pairs.next()) |pair| {
        if (std.mem.indexOf(u8, pair, "=")) |eq_index| {
            const key = try allocator.dupe(u8, pair[0..eq_index]);
            const value = try allocator.dupe(u8, pair[eq_index + 1 ..]);
            errdefer {
                allocator.free(key);
                allocator.free(value);
            }
            try params.put(key, value);
        }
    }

    return params;
}

pub fn getQueryParam(target: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, target, "?")) |query_index| {
        const query_string = target[query_index + 1 ..];
        while (std.mem.split(u8, query_string, "&").next()) |pair| {
            if (std.mem.startsWith(u8, pair, key) and pair.len > key.len and pair[key.len] == '=') {
                return pair[key.len + 1 ..];
            }
        }
    }
    return null;
}

pub fn readPostBody(allocator: std.mem.Allocator, reader: anytype, request: *std.http.Server.Request) ![]u8 {
    const len = request.head.content_length orelse return error.NoContentLength;
    if (len == 0) return "";

    const body = try allocator.alloc(u8, @intCast(len));
    errdefer allocator.free(body);

    const bytes_read = try reader.readAll(body);
    if (bytes_read != len) return error.IncompleteBody;

    return body;
}
