# Minions - Agent Guidelines

## Overview
Minions is a full stack app that manages processes spawned from nix flakes. It's designed to be a simple and easy to use tool for managing processes on a system, providing the user with a straightforward interface to manage processes, CLI args, environment variables for each process.

## Commands
- **Dev**: `bun run dev` (runs client + server concurrently)
- **Build**: `bun run build` (builds both client and server)
- **Typecheck**: `bun run typecheck` (checks both tsconfig.client.json and tsconfig.server.json)
- **Test**: `bun test` (bun test framework, not vitest/jest)
- remote/cloud agents may require `npm install -g bun` to run these commands.

## Architecture
- **Full-stack app**: Hono API server + React/Vite client
- **Server** (src/server): Hono routes, bun:sqlite DB, manages nix flake processes
- **Client** (src/client): React 19, TanStack Table, shadcn/ui, Tailwind CSS
- **Shared** (src/shared): TypeScript types used by both client/server
- **Database**: SQLite (bun:sqlite) with `processes` and `process_state` tables in minions.db

## Code Style (Biome)
- **Formatter**: Tabs for indentation, double quotes for strings
- **Imports**: Organize imports automatically (biome assist)
- **Runtime**: Use Bun APIs over Node.js (see .cursor/rules)
  - Use `bun:sqlite` not better-sqlite3
  - Use `Bun.file` over node:fs
  - Use `Bun.$` for shell commands
- **Types**: Strict TypeScript, use shared types from src/shared/types.ts
- **React**: React 19 with classic JSX runtime, functional components with hooks
