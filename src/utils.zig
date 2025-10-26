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

            for (value) |*c| {
                if (c.* == '+') c.* = ' ';
            }

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

pub fn parseDotEnv(allocator: std.mem.Allocator, env_vars: []const u8) !std.StringHashMap([]const u8) {
    var params = std.StringHashMap([]const u8).init(allocator);

    var pairs = std.mem.splitScalar(u8, env_vars, '\n');
    while (pairs.next()) |pair| {
        const trimmed = std.mem.trim(u8, pair, " \t\r");

        if (trimmed.len == 0 or trimmed[0] == '#') continue;

        if (std.mem.indexOf(u8, trimmed, "=")) |eq_index| {
            const key = std.mem.trim(u8, trimmed[0..eq_index], " \t");
            const value_raw = std.mem.trim(u8, trimmed[eq_index + 1 ..], " \t");

            const value = if (value_raw.len >= 2 and
                ((value_raw[0] == '"' and value_raw[value_raw.len - 1] == '"') or
                    (value_raw[0] == '\'' and value_raw[value_raw.len - 1] == '\'')))
                value_raw[1 .. value_raw.len - 1]
            else
                value_raw;

            const key_copy = try allocator.dupe(u8, key);
            const value_copy = try allocator.dupe(u8, value);
            try params.put(key_copy, value_copy);
        }
    }

    return params;
}

test "getQueryParam parses values and handles missing" {
    // present
    const v_id_opt = getQueryParam("/edit?id=123&foo=bar", "id");
    try std.testing.expect(v_id_opt != null);
    try std.testing.expectEqualStrings("123", v_id_opt.?);

    // absent
    const v_absent = getQueryParam("/edit?foo=bar", "id");
    try std.testing.expect(v_absent == null);

    // no query string
    const v_none = getQueryParam("/edit", "id");
    try std.testing.expect(v_none == null);

    // prefix should not match ("id" vs "identifier")
    const v_prefix = getQueryParam("/edit?identifier=1", "id");
    try std.testing.expect(v_prefix == null);
}

test "parseKeyValuePairs parses and percent-decodes" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    var params = try parseKeyValuePairs(allocator, "a=1&b=2&na%6De=va%20l&badpair");
    defer params.deinit();

    const a = params.get("a");
    try std.testing.expect(a != null);
    try std.testing.expectEqualStrings("1", a.?);

    const b = params.get("b");
    try std.testing.expect(b != null);
    try std.testing.expectEqualStrings("2", b.?);

    const name = params.get("name");
    try std.testing.expect(name != null);
    try std.testing.expectEqualStrings("va l", name.?);

    const bad = params.get("badpair");
    try std.testing.expect(bad == null);
}

test "dotenv parsing" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const dotenv =
        \\# Comment line
        \\KEY1=value1
        \\KEY2=value2
        \\
        \\# Another comment
        \\QUOTED_DOUBLE="value with spaces"
        \\QUOTED_SINGLE='another value'
        \\SPACES_AROUND = trimmed value
        \\EMPTY_VALUE=
        \\UNQUOTED=no quotes here
    ;

    var params = try parseDotEnv(allocator, dotenv);
    defer params.deinit();

    // Basic values
    try std.testing.expectEqualStrings("value1", params.get("KEY1").?);
    try std.testing.expectEqualStrings("value2", params.get("KEY2").?);

    // Quoted values (quotes should be stripped)
    try std.testing.expectEqualStrings("value with spaces", params.get("QUOTED_DOUBLE").?);
    try std.testing.expectEqualStrings("another value", params.get("QUOTED_SINGLE").?);

    // Whitespace around = should be trimmed
    try std.testing.expectEqualStrings("trimmed value", params.get("SPACES_AROUND").?);

    // Empty value
    try std.testing.expectEqualStrings("", params.get("EMPTY_VALUE").?);

    // Unquoted
    try std.testing.expectEqualStrings("no quotes here", params.get("UNQUOTED").?);

    // Comments should not be parsed
    try std.testing.expect(params.get("#") == null);
    try std.testing.expect(params.get("Comment") == null);
}
