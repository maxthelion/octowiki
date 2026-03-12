---
title: "Implementation Plan"
category: "meta"
tags: [implementation, tasks, bun, typescript, hono, react, testing]
summary: "Step-by-step chunked implementation plan for building OctoWiki, organized into tasks with TDD workflow and checkpoint commits."
last-modified-by: agent
---

## Overview

This is the detailed build plan for OctoWiki, derived from the [[design-spec]]. It breaks the implementation into sequential chunks, each containing multiple tasks. Every task follows a TDD workflow: write failing tests, implement, verify, commit.

The plan targets the [[wiki-agent-system-spec]] as the source specification and uses the design decisions documented in [[design-spec]].

## Tech Stack

- **Runtime:** Bun (v1.3+)
- **Backend:** TypeScript + Hono
- **Frontend:** React SPA (Vite), React Router, React Query
- **Agents:** Anthropic SDK (Haiku 4.5 for watcher, Sonnet 4.6 for planning/execution/chat)
- **Search:** qmd CLI (BM25 + vector embeddings)
- **Markdown:** markdown-it with custom wikilink plugins

See [[project-config]] for Bun-specific conventions.

## Chunk 1: Project Setup + Wiki Core

1. **Project Scaffolding** -- `package.json`, `tsconfig.json`, `src/types.ts`, directory structure, `.gitignore`
2. **Frontmatter Parser** -- `src/wiki/frontmatter.ts` using gray-matter; parse, update, and serialize YAML frontmatter
3. **Wikilink Parser** -- `src/wiki/wikilinks.ts` with regex-based parser for all 8 link types
4. **Page CRUD** -- `src/wiki/pages.ts` for reading, writing, listing, and deleting wiki pages
5. **Backlinks** -- `src/wiki/backlinks.ts` to compute and persist backlink maps from wikilinks
6. **Lock Manager** -- `src/wiki/lock.ts` for exclusive `agent-writing.lock` with PID-based stale detection

## Chunk 2: HTTP Server + API

7. **Hono Server** -- `src/server/app.ts` entry point with route mounting
8. **Pages API** -- `GET /api/pages`, `GET /api/pages/:slug`, `POST /api/pages`
9. **SSE** -- `src/server/sse.ts` with event types: page-changed, feed-updated, plan-status-changed
10. **Search API** -- `GET /api/search?q=...&mode=...` bridging to qmd CLI
11. **Feed API** -- `GET /api/feed` serving from `queue.json`
12. **Taxonomy API** -- `GET /api/taxonomy` reading `taxonomy.md`

## Chunk 3: File Watcher

13. **Watcher** -- `src/watcher/index.ts` using `Bun.watch()` with dual debounce (2s SSE, 30s Haiku)
14. **Trigger Dispatch** -- `src/watcher/triggers.ts` dispatching to Haiku on idle timeout

## Chunk 4: Agent Integration

15. **Anthropic Client** -- `src/agents/client.ts` wrapping the SDK
16. **Haiku Agent** -- `src/agents/haiku.ts` for change interpretation and tag suggestions
17. **Chat API** -- `POST /api/chat/:page` with single-turn page editing
18. **Planning Agent** -- `src/agents/planner.ts` with two-tier retrieval
19. **Inbox API** -- `GET /api/inbox`, `POST /api/inbox/:planId/approve`
20. **Execution Agent** -- `src/agents/executor.ts` working on git branches

## Chunk 5: Frontend

21. **Vite + React setup** -- `web/` directory with routing and React Query
22. **Page components** -- PageView (markdown renderer), PageList (sidebar), ChatBox (fixed bottom)
23. **Feed & Inbox** -- ChangesFeed panel with selection, Inbox view with approve/reject
24. **Wikilink rendering** -- markdown-it plugin for all 8 syntax types, HoverSummary tooltips
25. **SSE integration** -- `useSSE` hook invalidating React Query caches

## Testing Strategy

- **Unit tests** (Bun test): frontmatter, wikilinks, backlinks, debounce, lock management
- **Integration tests**: watcher-to-Haiku pipeline (mock API), chat flow, plan approval flow
- **No e2e browser tests for v1**

All tasks produce checkpoint commits. See [[readme-overview]] for quick start instructions.
