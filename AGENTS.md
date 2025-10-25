# Minions - Zig Process Manager

## Build & Test Commands

- **Build**: `zig build`
- **Run**: `zig build run` (starts HTTP server on localhost:3000)
- **Test all**: `zig build test`
- **Test single file**: `zig test src/<filename>.zig` (e.g., `zig test src/db.zig`)

## Architecture

- **Web server**: Simple HTTP server managing Nix flake processes via SQLite
- **Database**: SQLite (`minions.db`) with two tables: `processes` (flake configs) and `process_state` (runtime state)
- **Core modules**: `db.zig` (SQLite wrapper), `nix.zig` (process spawning), `utils.zig` (helpers), `root.zig` (routing)
- **Main entry**: `src/main.zig` starts server; `src/root.zig` handles HTTP routing

## Code Style

- **Memory**: Use arena allocators for request scope; call `deinit()` with explicit defer for owned resources
- **Naming**: snake_case for functions/variables, PascalCase for types, camelCase for functions, SCREAMING_SNAKE for constants
- **Tests**: Inline tests at end of files; use `:memory:` for DB tests; ArenaAllocator for test allocations
