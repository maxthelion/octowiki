---
title: Bun Runtime
category: architecture
parent: system-architecture
tags: [bun, runtime, tooling, api, frontend]
summary: "Bun is the sole JavaScript runtime, bundler, and package manager for this project, replacing Node.js and its ecosystem of third-party tools."
last-modified-by: agent
---

## Overview

This project uses [Bun](https://bun.sh) as its JavaScript runtime, replacing Node.js. Bun is an all-in-one toolkit: it executes TypeScript and JavaScript natively, manages packages, runs tests, and bundles assets — without requiring separate tools like `ts-node`, `jest`, `webpack`, or `esbuild`.

Bun is also the standard for all [[skills]] and automation scripts in the project.

## Command Equivalents

Every standard Node.js operation has a direct Bun equivalent:

| Operation | Bun | Do not use |
|-----------|-----|------------|
| Run a file | `bun <file>` | `node <file>`, `ts-node <file>` |
| Run tests | `bun test` | `jest`, `vitest` |
| Build assets | `bun build <file.html\|file.ts\|file.css>` | `webpack`, `esbuild` |
| Install packages | `bun install` | `npm install`, `yarn install`, `pnpm install` |
| Run a script | `bun run <script>` | `npm run <script>` |
| Run a CLI tool | `bunx <package> <command>` | `npx <package> <command>` |

## Environment Variables

Bun automatically loads `.env` files on startup. The `dotenv` package is not needed and should not be used.

## Built-in APIs

Bun ships native implementations of common server and systems APIs. These replace third-party packages:

| Purpose | Bun API | Do not use |
|---------|---------|------------|
| HTTP server (with WebSockets, HTTPS, routes) | `Bun.serve()` | `express` |
| SQLite | `bun:sqlite` | `better-sqlite3` |
| Redis | `Bun.redis` | `ioredis` |
| Postgres | `Bun.sql` | `pg`, `postgres.js` |
| WebSocket client | `WebSocket` (built-in) | `ws` |
| File I/O | `Bun.file()` | `node:fs` `readFile`/`writeFile` |
| Shell commands | `Bun.$\`...\`` | `execa` |

Using these built-ins produces smaller bundle sizes and better runtime performance than their third-party equivalents.

## Frontend Development

Bun replaces Vite for frontend asset bundling. HTML files served via `Bun.serve()` can directly import `.tsx`, `.jsx`, or `.js` files — Bun's bundler transpiles and bundles them automatically. `<link>` tags pointing to `.css` files are also handled by Bun's CSS bundler.

### Server setup

```ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => new Response(JSON.stringify({ id: req.params.id })),
    },
  },
  development: {
    hmr: true,
    console: true,
  },
})
```

Run with hot module reload during development:

```sh
bun --hot ./index.ts
```

### HTML entry point

```html
<html>
  <body>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

The `.tsx` file can import CSS directly and use React without any additional configuration.

## Testing

Bun provides a built-in test runner accessed via `bun test`. See the project's test files for usage patterns. Tests follow this structure:

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

## Key Design Constraints

- **Single runtime:** All server, tooling, and scripting code runs on Bun. There is no Node.js fallback.
- **No legacy bundlers:** Webpack, esbuild (standalone), and Vite are not used. Bun's bundler handles all asset pipelines.
- **No third-party DB/Redis clients:** Native Bun APIs are the only approved integration points for SQLite, Redis, and Postgres.

## Related

- [[skills]] — automation scripts that execute under the Bun runtime
- [[bootstrapping]] — the batch import pipeline, which runs via `bun run` scripts
