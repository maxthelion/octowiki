---
title: System Architecture
category: architecture
tags: [architecture, system-design, components, backend, frontend]
summary: "OctoWiki runs as a single Bun process composed of four integrated subsystems: an HTTP server, a file watcher, an agent orchestrator, and a wiki core — all sharing a common TypeScript module hierarchy."
last-modified-by: agent
---

## Overview

OctoWiki is a single Bun process that combines a web server, a file watcher, Claude-powered agents, and a wiki content core. All subsystems run in the same process and communicate through shared in-memory state and a common wiki core library. The entry point is `src/index.ts`, which starts both the HTTP server and the file watcher.

The system is designed to be a complete, self-contained wiki engine: the backend handles API requests and live updates, the agents perform background intelligence tasks, and the frontend is a React SPA served directly from the same process.

## Top-Level Components

### HTTP Server (Hono)

The server (`src/server/`) is built on the Hono framework and serves three responsibilities:

- **React SPA delivery** — serves the frontend bundle at the root route
- **REST API** — exposes endpoints for pages, chat, search, taxonomy, planning, and an agent inbox
- **Server-Sent Events (SSE)** — pushes live updates to the frontend when wiki pages change, via `src/server/sse.ts`

API routes are organised under `src/server/routes/`:

| File | Endpoints |
|---|---|
| `pages.ts` | `GET /api/pages`, `GET /api/pages/:slug`, `POST /api/pages` |
| `chat.ts` | `POST /api/chat/:page` |
| `feed.ts` | `GET /api/feed` |
| `plan.ts` | `POST /api/plan` |
| `inbox.ts` | `GET /api/inbox`, `POST /api/inbox/:planId/approve` |
| `search.ts` | `GET /api/search?q=...&mode=...` |
| `taxonomy.ts` | `GET /api/taxonomy` |

### File Watcher

The watcher (`src/watcher/`) uses Bun's `fs.watch` to monitor two directories: `wiki/pages/*.md` and `wiki/meta/*.md`. It implements a **dual debounce model**:

- **2-second debounce** — triggers an SSE notification to connected frontend clients
- **30-second idle debounce** — triggers the Haiku summarization agent via `src/watcher/triggers.ts`

To prevent feedback loops, the watcher checks the `last-modified-by` frontmatter tag and the presence of `.lock` files before dispatching. This ensures agent-written changes do not re-trigger themselves.

### Agent Orchestrator

The agents subsystem (`src/agents/`) manages three Claude integrations:

- **Haiku watcher** (`src/agents/haiku.ts`) — a lightweight, always-on summarizer triggered by file changes after the 30-second idle debounce. Uses Claude Haiku 4.5 for cost efficiency.
- **Planning agent** (`src/agents/planner.ts`) — invoked on-demand via `POST /api/plan`. Uses Claude Sonnet 4.6 for complex multi-step reasoning.
- **Execution agent** (`src/agents/executor.ts`) — runs in the background on a branch-based model to implement approved plans.

All agents share `src/agents/client.ts`, a thin wrapper around the Anthropic SDK.

The model selection reflects a deliberate trade-off: Haiku runs continuously and must be cheap; Sonnet is only invoked when a user explicitly triggers planning or execution.

### Wiki Core

The wiki core (`src/wiki/`) is a shared library used by all other subsystems. It is the single point of authority for reading and writing wiki content:

| Module | Responsibility |
|---|---|
| `pages.ts` | Read, write, and list markdown pages |
| `frontmatter.ts` | Parse and update YAML frontmatter |
| `wikilinks.ts` | Parse `[[...]]` syntax |
| `backlinks.ts` | Maintain `backlinks.json` |
| `taxonomy.ts` | Read and update `taxonomy.md` |
| `lock.ts` | `.lock` file management for concurrency |

The lock file (`agent-writing.lock`) prevents concurrent writes from multiple agents or agent-plus-user conflicts.

### qmd Bridge

The search module (`src/search/qmd.ts`) shells out to the `qmd` CLI to provide two search modes: BM25 full-text search and vector embeddings. The index is gitignored and regenerated on each clone. This is an intentional boundary: search indexing is delegated to an external tool rather than implemented in-process.

## Directory Layout

```
octowiki/
├── src/                    ← Backend (Bun + Hono)
│   ├── index.ts            ← Entry point
│   ├── types.ts            ← Shared TypeScript interfaces
│   ├── server/             ← HTTP server, routes, SSE
│   ├── agents/             ← Claude agent integrations
│   ├── watcher/            ← File watcher with dual debounce
│   ├── wiki/               ← Core: pages, frontmatter, wikilinks, backlinks
│   └── search/             ← qmd CLI bridge
├── web/                    ← Frontend (React + Vite)
│   └── src/
│       ├── components/     ← PageView, ChatBox, Feed, Inbox, etc.
│       ├── hooks/          ← React Query + SSE hooks
│       └── lib/            ← Markdown renderer with wikilink support
└── wiki/                   ← Wiki content
    ├── pages/              ← Markdown pages
    ├── meta/               ← taxonomy.md, inbox.md
    └── .meta/              ← Agent data (queue, backlinks, plans)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun (TypeScript) |
| HTTP framework | Hono |
| AI agents | Anthropic SDK (Haiku 4.5, Sonnet 4.6) |
| Frontend | React SPA with Vite |
| State management | React Query |
| Search | qmd CLI (BM25 + vector) |
| Shared types | `src/types.ts` |

## Key Design Constraints and Trade-offs

**Single-process deployment.** Everything runs in one Bun process. This simplifies deployment and eliminates inter-process communication overhead, but means a crash in any subsystem affects the whole application.

**File system as the database.** Wiki pages are plain markdown files on disk. This makes content human-readable and git-friendly, but requires the watcher and lock file system to coordinate concurrent access.

**Agent model tier split.** Haiku is used for always-on background work; Sonnet is reserved for on-demand, complex tasks. This controls API cost at the expense of some capability in background tasks.

**External search index.** Delegating to `qmd` keeps the core codebase simple but introduces an external runtime dependency and requires index regeneration after a fresh clone.

## Relationships

- The [[skills]] system (e.g. `add-page`, `batch-import`) operates outside the running server process — they are CLI scripts that write directly to `wiki/pages/` and are picked up by the file watcher on next change.
- [[sidebar-tree-navigation]] is a frontend component served by the HTTP server and populated via the `GET /api/taxonomy` endpoint, which reads from the wiki core's taxonomy module.
- The [[agent-activity-indicator]] in the frontend consumes the SSE feed from `src/server/sse.ts` to reflect live agent activity.
