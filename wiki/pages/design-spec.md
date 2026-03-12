---
title: "Implementation Design Spec"
category: "architecture"
tags: [architecture, design-decisions, bun, hono, react, agents, qmd]
summary: "Approved design document resolving all open questions from the system spec and defining the tech stack, architecture, data flows, and module structure."
last-modified-by: agent
---

## Overview

This is the approved implementation design for OctoWiki, resolving all 14 open questions from the [[wiki-agent-system-spec]] and specifying the concrete architecture. It serves as the primary reference for the [[implementation-plan]].

## Resolved Open Questions

Key decisions made:

| Decision | Choice |
|----------|--------|
| Planning agent wiki write access | Codebase + inbox.md only |
| Chat history window | Fixed global, last 10 exchanges |
| Execution agent autonomy | Fully autonomous after approval |
| Haiku trigger threshold | 30s idle (separate from 2s SSE debounce) |
| Tag changes | Auto-apply with undo logging |
| Planning context strategy | Summaries upfront, full pages on demand |
| Vector embedding refresh | On significant changes only |
| Chat turn model | Single-turn (message -> page edit -> done) |
| Chat input placement | Fixed to bottom of viewport |
| Git history depth | Depth limit + summarise older history |
| Multi-repo support | Single repo only for v1 |
| Process model | Single daemon |
| Standalone vs Desktop | Standalone CLI first, Desktop extension later |
| qmd index sharing | Gitignored, regenerate on clone |

## Tech Stack

- **Runtime:** Bun
- **Backend:** TypeScript + Hono (HTTP framework)
- **Frontend:** React SPA (Vite)
- **Agents:** Anthropic SDK (Haiku 4.5 for watcher, Sonnet 4.6 for planning/execution)
- **Search:** qmd CLI (BM25 + vector embeddings)

See [[project-config]] for Bun-specific conventions and API preferences.

## Architecture

Single Bun process serving as HTTP server (Hono), file watcher (`fs.watch`), agent orchestrator, and qmd bridge. The React SPA connects via REST API and SSE for live updates.

### Dual Debounce Model

- **2s debounce:** SSE notification to browser for page re-renders
- **30s idle debounce:** Haiku interpretation pass (batches rapid edits)
- Chat agent writes bypass both debounces (SSE pushed directly)

## Data Flows

Four primary flows:

1. **User edits page** -> fs.watch -> SSE (2s) -> Haiku interpretation (30s idle) -> change summary to queue
2. **User sends chat** -> POST /api/chat/:page -> agent edits page -> SSE push -> re-render
3. **User approves plan** -> POST /api/inbox/:planId/approve -> execution agent runs on git branch
4. **User triggers planning** -> POST /api/plan -> planning agent produces plan in inbox.md

## Module Structure

Backend modules under `src/`: server (Hono + routes + SSE), watcher (fs.watch + triggers), agents (haiku, planner, executor, client), wiki (pages, frontmatter, wikilinks, backlinks, taxonomy, lock), search (qmd bridge).

Frontend under `web/src/`: components (PageView, ChatBox, ChangesFeed, Inbox, PageList, AddPage, HoverSummary, SourceBlock), hooks (useSSE, usePages), lib (markdown renderer).

## Key Implementation Details

- **Loop prevention:** Three guards -- frontmatter origin tag, write lock, directory separation
- **Tag auto-apply:** Haiku applies suggestions directly, logging previous state for undo
- **Execution branching:** Agent works on `octowiki/plan-YYYY-MM-DD-NNN` branches; main is never modified directly
- **Lock concurrency:** Exclusive PID-based lock with 10s queue timeout and stale detection
- **Frontend routing:** React Router with `/page/:slug`, `/feed`, `/inbox`, `/search`; React Query for server state

## Deferred Features

- Bootstrapping plugin (spec Section 11)
- Desktop Extension / .mcpb (spec Section 12)
- Git reference validation hooks (spec Section 10)
- Monorepo / multi-repo support

These are detailed in the [[wiki-agent-system-spec]] but not targeted for v1.
