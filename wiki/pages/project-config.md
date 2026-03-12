---
title: "Project Configuration (CLAUDE.md)"
category: "reference"
tags: [bun, configuration, conventions, testing, frontend, apis]
summary: "Bun-specific conventions and API preferences for the OctoWiki project, derived from CLAUDE.md."
last-modified-by: agent
---

## Overview

OctoWiki uses Bun as its runtime. This page documents the project conventions and preferred APIs, ensuring consistent tooling choices across the codebase. These conventions apply to all implementation work in the [[implementation-plan]].

## Runtime: Bun over Node.js

All commands use Bun equivalents:

| Instead of | Use |
|------------|-----|
| `node` / `ts-node` | `bun <file>` |
| `jest` / `vitest` | `bun test` |
| `webpack` / `esbuild` | `bun build` |
| `npm install` / `yarn` / `pnpm` | `bun install` |
| `npx` | `bunx` |

Bun automatically loads `.env` files -- do not use dotenv.

## Preferred APIs

| Concern | Use | Avoid |
|---------|-----|-------|
| HTTP server | `Bun.serve()` (supports WebSockets, HTTPS, routes) | express |
| SQLite | `bun:sqlite` | better-sqlite3 |
| Redis | `Bun.redis` | ioredis |
| Postgres | `Bun.sql` | pg, postgres.js |
| WebSocket | Built-in `WebSocket` | ws |
| File I/O | `Bun.file` | node:fs readFile/writeFile |
| Shell commands | `Bun.$\`cmd\`` | execa |

Note: The [[design-spec]] chose Hono as the HTTP framework on top of Bun, and Vite for the frontend dev server. These are project-specific choices layered on top of the Bun defaults above.

## Testing

Use `bun test` with imports from `bun:test`:

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

## Frontend

Bun supports HTML imports with `Bun.serve()` and automatic bundling of `.tsx`, `.jsx`, `.js`, and CSS. For development, use `bun --hot ./index.ts` for hot module replacement.

For detailed Bun API documentation, see `node_modules/bun-types/docs/**.mdx`.
