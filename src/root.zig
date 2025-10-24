const std = @import("std");
const sqlite = @cImport({
    @cInclude("sqlite3.h");
});
