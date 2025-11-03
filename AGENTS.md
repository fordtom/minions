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

## Code Style
- **Runtime**: Use Bun APIs over Node.js (see .cursor/rules)
  - Use `bun:sqlite` not better-sqlite3
  - Use `Bun.file` over node:fs
  - Use `Bun.$` for shell commands
- **Types**: Strict TypeScript, use shared types from src/shared/types.ts
- **React**: React 19 with classic JSX runtime, functional components with hooks

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance
- Use ref as a prop instead of `React.forwardRef`

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting
