const std = @import("std");
pub const db = @import("db.zig");
pub const process = @import("process.zig");
pub const httputils = @import("httputils.zig");

pub fn route(
    request: *std.http.Server.Request,
    // reader: anytype,
    database: *db.Database,
    allocator: std.mem.Allocator,
) !void {
    const method = request.head.method;
    const target = request.head.target;

    // GET /
    if (method == .GET and std.mem.eql(u8, target, "/")) {
        return handleOverview(request, database, allocator);
    }

    // // GET /edit or /edit?id=123
    // if (method == .GET and std.mem.startsWith(u8, target, "/edit")) {
    //     const id_str = httputils.getQueryParam(target, "id");
    //     return handleEdit(request, database, allocator, id_str);
    // }

    // // POST /api/processes/toggle
    // if (method == .POST and std.mem.eql(u8, target, "/api/processes/toggle")) {
    //     return handleToggle(request, reader, database, allocator);
    // }

    // // POST /api/processes/delete
    // if (method == .POST and std.mem.eql(u8, target, "/api/processes/delete")) {
    //     return handleDelete(request, reader, database, allocator);
    // }

    // // POST /api/processes (create or update)
    // if (method == .POST and std.mem.eql(u8, target, "/api/processes")) {
    //     return handleSave(request, reader, database, allocator);
    // }

    // 404 - just redirect to /
    const location_header = std.http.Header{ .name = "location", .value = "/" };
    try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
}

fn handleOverview(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator) !void {
    const template = try httputils.readFile(allocator, "public/index.html");
    defer allocator.free(template);

    const process_list = try database.listProcesses(allocator);
    defer {
        for (process_list) |*p| p.deinit();
        allocator.free(process_list);
    }

    // initialise some buffer to store the generated html text in?
    var rows = std.ArrayList(u8){};
    errdefer rows.deinit(allocator);
    const writer = rows.writer(allocator);

    for (process_list) |p| {
        const state = try database.getProcessState(p.id);

        try writer.print(
            \\        <tr>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>{s}</td>
            \\            <td>
            \\                <form action="/process/edit?id={d}" method="GET" style="display:inline;">
            \\                    <button>✏️</button>
            \\                </form>
            \\                <form action="/process/{d}/start" method="POST" style="display:inline;">
            \\                    <button>▶️</button>
            \\                </form>
            \\                <form action="/process/{d}/stop" method="POST" style="display:inline;">
            \\                    <button>⏹️</button>
            \\                </form>
            \\                <form action="/process/{d}/delete" method="POST" style="display:inline;">
            \\                    <button>🗑️</button>
            \\                </form>
            \\            </td>
            \\        </tr>
            \\
        , .{ p.flake_url, p.args orelse "", p.env_vars orelse "", state.?.status.toString(), p.id, p.id, p.id, p.id });
    }

    const output = try std.mem.replaceOwned(u8, allocator, template, "{{PROCESS_ROWS}}", rows.items);
    try request.respond(output, .{ .status = .ok, .extra_headers = &.{httputils.CONTENT_TYPE_HTML} });
}

// fn handleEdit(request: *std.http.Server.Request, database: *db.Database, allocator: std.mem.Allocator, id: ?[]const u8) !void {
//     // TODO: if id != null, query process and prefill form
//     _ = database;
//     _ = id;
//     const html = "<h1>Edit</h1>";
//     try request.respond(html, .{ .status = .ok, .extra_headers = &.{httputils.CONTENT_TYPE_HTML} });
// }

// fn handleToggle(request: *std.http.Server.Request, reader: anytype, database: *db.Database, allocator: std.mem.Allocator) !void {
//     // TODO: read body, parse id, toggle state
//     _ = reader;
//     _ = database;
//     const location_header = std.http.Header{ .name = "location", .value = "/" };
//     try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
// }

// fn handleDelete(request: *std.http.Server.Request, reader: anytype, database: *db.Database, allocator: std.mem.Allocator) !void {
//     // TODO: read body, parse id, delete process
//     _ = reader;
//     _ = database;
//     const location_header = std.http.Header{ .name = "location", .value = "/" };
//     try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
// }

// fn handleSave(request: *std.http.Server.Request, reader: anytype, database: *db.Database, allocator: std.mem.Allocator) !void {
//     // TODO: read body, parse fields, create or update based on id presence
//     _ = reader;
//     _ = database;
//     const location_header = std.http.Header{ .name = "location", .value = "/" };
//     try request.respond("", .{ .status = .found, .extra_headers = &.{location_header} });
// }

test {
    std.testing.refAllDecls(@This());
}
