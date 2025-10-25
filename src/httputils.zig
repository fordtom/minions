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

    var pairs = std.mem.splitScalar(u8, query_string, '&');
    while (pairs.next()) |pair| {
        if (std.mem.indexOf(u8, pair, "=")) |eq_index| {
            const key = try allocator.dupe(u8, pair[0..eq_index]);
            const value = try allocator.dupe(u8, pair[eq_index + 1 ..]);

            const decoded_key = std.Uri.percentDecodeBackwards(key, key);
            const decoded_value = std.Uri.percentDecodeBackwards(value, value);

            try params.put(decoded_key, decoded_value);
        }
    }

    return params;
}

pub fn getQueryParam(target: []const u8, key: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, target, "?")) |query_index| {
        const query_string = target[query_index + 1 ..];
        var pairs = std.mem.splitScalar(u8, query_string, '&');
        while (pairs.next()) |pair| {
            if (std.mem.startsWith(u8, pair, key) and pair.len > key.len and pair[key.len] == '=') {
                return pair[key.len + 1 ..];
            }
        }
    }
    return null;
}
