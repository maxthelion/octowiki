---
title: Issues with v1
category: reference
tags: [bugs, improvements, v1]
summary: Known issues and areas for improvement in the v1 implementation.
last-modified-by: user
---

## Code Review Findings

From the final code review, these issues were identified and **not yet fixed**:

### Not Yet Addressed

- `chatWithPage` lives in `haiku.ts` but uses Sonnet — should be in its own module
- `POST /api/pages` doesn't use an agent for page creation (spec says it should infer title, category, tags)
- `HoverSummary` component is defined but never wired up — wikilinks don't show hover tooltips
- `SourceBlock` shows placeholder text instead of actual source code with syntax highlighting
- No `SIGTERM` handler (only `SIGINT`) — matters for container deployments
- Inline styles throughout all React components — no stylesheet or CSS modules
- `any` types in `ChangesFeed`, `Inbox`, `Search` components
- `AddPage.tsx` was inlined into `PageList` instead of being a separate modal component
- `search` function in `qmd.ts` silently swallows errors
- `pendingFiles` set in fast debounce callback grows without bound between slow callbacks
- No integration tests for the agent pipeline (with mocked Anthropic API)
- Duplicate `WikiLink` interface in both `types.ts` and `wikilinks.ts`

### Fixed in Code Review Pass

- Path traversal in static file serving (C1)
- XSS via `html: true` in markdown-it (C2)
- XSS in wikilink renderer via unescaped attributes (C3)
- TOCTOU race in lock acquisition (C4)
- Slug/planId validation on route params (I6)
- `git add -A` in executor replaced with targeted add (I3)
- Executor branch restore moved to `finally` block (I4)
- Frontend fetch hooks now check `response.ok` (I8)

## Chat Agent Questions

- Chat submits to `POST /api/chat/:page` → calls `chatWithPage` in `src/agents/haiku.ts` using **Sonnet 4.6**
- Single-turn: one message → one page edit → done
- Requires `ANTHROPIC_API_KEY` — no fallback if key is missing
- System prompt tells agent to return JSON with `updatedContent` and `agentMessage`
- Sees last 10 exchanges for context, plus the full page content
- Where should the prompt live? Currently hardcoded in `haiku.ts:78-86`
- Should chat work without an API key? Could fall back to a no-op or local model
- The function is in the wrong file (`haiku.ts` but uses Sonnet) — see code review findings above

## Other Notes

- Bootstrapper (`src/bootstrap.ts`) requires `ANTHROPIC_API_KEY` — used subagent workaround instead
- Vite config had `root: "web"` which broke builds from within `web/` directory (fixed)
- Bun's `sendfile` on macOS can't serve directories — needed `statSync().isFile()` guard (fixed)
