# OctoWiki — Implementation Design

**Status:** Approved
**Date:** 2026-03-12
**Source spec:** `spec/wiki-agent-system-spec.md`

---

## 1. Resolved Open Questions

| # | Question | Decision |
|---|----------|----------|
| OQ-1 | Planning agent wiki write access | Codebase + inbox.md only — no wiki write access |
| OQ-2 | Chat history window size | Fixed global — last 10 exchanges |
| OQ-3 | Execution agent autonomy | Fully autonomous after plan approval |
| OQ-4 | Haiku trigger threshold | Time-based — 30s idle before Haiku interpretation (separate from 2s watcher debounce for SSE) |
| OQ-5 | Tag change behaviour | Auto-apply with undo logging |
| OQ-6 | Planning agent wiki context | Summaries upfront, full pages on demand |
| OQ-7 | Vector embedding refresh | On significant changes only |
| OQ-8 | Chat-in-page turn model | Single-turn (message → page edit → done) |
| OQ-9 | Chat input placement | Fixed to bottom of viewport |
| OQ-10 | Git history depth for bootstrapping | Depth limit + summarisation for older history |
| OQ-11 | Monorepo / multi-repo support | Single repo only for v1 |
| OQ-12 | Process model | Single daemon |
| OQ-13 | Standalone vs Desktop extension | Standalone CLI first, Desktop extension later |
| OQ-14 | qmd index sharing | Gitignored, regenerate on clone |

---

## 2. Tech Stack

- **Runtime:** Bun
- **Backend:** TypeScript + Hono (HTTP framework)
- **Frontend:** React SPA (Vite)
- **Agents:** Anthropic SDK (Haiku 4.5 for watcher, Sonnet 4.6 for planning/execution)
- **Search:** qmd CLI (BM25 + vector embeddings)
- **Scope:** Full pipeline — viewer + watcher + all agents

---

## 3. Architecture

Single Bun process serving as:
1. **HTTP server** (Hono) — serves React SPA, REST API for chat + pages, SSE for live updates
2. **File watcher** (Bun's `fs.watch`) — monitors `/wiki/pages/*.md` and `/wiki/meta/*.md`, 2s debounce for SSE notifications, 30s idle threshold before Haiku interpretation
3. **Agent orchestrator** — manages Haiku watcher agent, planning agent, and execution agent via Anthropic SDK
4. **qmd bridge** — shells out to `qmd` CLI for search/indexing

```
┌─────────────────────────────────────────────┐
│                  Bun Process                 │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Hono    │  │  File    │  │  Agent    │  │
│  │  Server  │  │  Watcher │  │  Runner   │  │
│  │  + SSE   │  │ (2s/30s) │  │           │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
│  ┌────┴──────────────┴──────────────┴─────┐  │
│  │         Wiki Core (shared)              │  │
│  │  pages · frontmatter · wikilinks ·      │  │
│  │  backlinks · taxonomy · qmd bridge      │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │
    ┌────┴────┐
    │  React  │
    │   SPA   │
    └─────────┘
```

---

## 4. Data Flows

### Debounce Model

The watcher uses two debounce timers:
- **SSE debounce (2s):** After any file change, wait 2s then push SSE notification to browser. Fast feedback for page re-renders.
- **Haiku debounce (30s):** After user edits settle (30s idle), trigger Haiku interpretation pass. Batches rapid edits into a single summary.

Chat agent writes bypass both debounces — the chat endpoint pushes SSE directly after writing the page.

### User edits a wiki page

```
user saves .md file
  → fs.watch detects change
  → check: last-modified-by != agent, no .lock file
  → SSE push after 2s debounce (browser re-renders)
  → after 30s idle: Haiku interpretation pass
    → update backlinks, qmd update
    → if significant: schedule qmd embed
    → auto-apply tag suggestions, log to undo history
    → append change summary to queue.json
    → SSE push: feed-updated
```

### User sends chat message

```
user types in chat box → POST /api/chat/:page
  → load: page content, last 10 history entries, qmd search results
  → agent edits page (sets last-modified-by: agent, acquires .lock)
  → write page to disk, release .lock
  → append exchange to .meta/pages/<page>.json
  → SSE push directly from chat endpoint (no debounce)
  → browser re-renders page
```

### User approves a plan

```
user clicks "Approve" in Inbox UI → POST /api/inbox/:planId/approve
  → update inbox.md: Status: pending → Status: approved
  → execution agent picks up plan JSON from .meta/plans/
  → executes autonomously on a git branch
  → on success: updates inbox status to done, logs to .meta/pages/*.json
  → on failure: updates inbox status to failed with error summary
  → SSE push: plan-status-changed
```

### User triggers planning

```
user selects change summaries in feed → clicks "Plan this"
  → POST /api/plan with selected change IDs
  → planning agent receives: selected summaries, all page summaries,
    backlinks.json, taxonomy.md, qmd search results
  → agent requests full pages as needed (two-tier retrieval)
  → produces plan entry in inbox.md + full plan JSON in .meta/plans/
  → SSE push: plan-status-changed
```

---

## 5. Module Structure

```
octowiki/
├── package.json
├── bunfig.toml
├── tsconfig.json
├── src/
│   ├── index.ts                    ← entry point: starts server + watcher
│   ├── server/
│   │   ├── app.ts                  ← Hono app setup
│   │   ├── routes/
│   │   │   ├── pages.ts            ← GET /api/pages, GET /api/pages/:slug, POST /api/pages (add page)
│   │   │   ├── chat.ts             ← POST /api/chat/:page
│   │   │   ├── feed.ts             ← GET /api/feed (changes feed)
│   │   │   ├── plan.ts             ← POST /api/plan (trigger planning from selected changes)
│   │   │   ├── inbox.ts            ← GET /api/inbox, POST /api/inbox/:planId/approve
│   │   │   ├── search.ts           ← GET /api/search?q=...&mode=...
│   │   │   └── taxonomy.ts         ← GET /api/taxonomy
│   │   └── sse.ts                  ← SSE event emitter
│   ├── watcher/
│   │   ├── index.ts                ← fs.watch on pages/ and meta/, dual debounce (2s SSE / 30s Haiku)
│   │   └── triggers.ts             ← dispatch to Haiku on 30s idle
│   ├── agents/
│   │   ├── haiku.ts                ← Haiku summariser agent
│   │   ├── planner.ts              ← Planning agent (on-demand)
│   │   ├── executor.ts             ← Execution agent (background)
│   │   └── client.ts               ← Anthropic SDK wrapper
│   ├── wiki/
│   │   ├── pages.ts                ← read/write/list pages
│   │   ├── frontmatter.ts          ← parse/update YAML frontmatter
│   │   ├── wikilinks.ts            ← parse [[...]] syntax
│   │   ├── backlinks.ts            ← maintain backlinks.json
│   │   ├── taxonomy.ts             ← read/update taxonomy.md
│   │   └── lock.ts                 ← agent-writing.lock management
│   ├── search/
│   │   └── qmd.ts                  ← shell out to qmd CLI
│   └── types.ts                    ← shared types
├── web/                            ← React SPA (Vite)
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── PageView.tsx         ← markdown renderer + wikilinks
│       │   ├── ChatBox.tsx          ← fixed-bottom chat input
│       │   ├── ChangesFeed.tsx      ← changes panel with checkboxes
│       │   ├── Inbox.tsx            ← pending plans view
│       │   ├── PageList.tsx         ← sidebar navigation
│       │   ├── AddPage.tsx          ← add page modal
│       │   ├── HoverSummary.tsx     ← tooltip for [[links]]
│       │   └── SourceBlock.tsx      ← collapsible source ref block
│       ├── hooks/
│       │   ├── useSSE.ts            ← SSE subscription
│       │   └── usePages.ts          ← page data fetching
│       └── lib/
│           └── markdown.ts          ← markdown-it + wikilink plugin
└── wiki/                           ← the actual wiki content (user data)
    ├── pages/
    ├── .meta/
    ├── .index/
    └── meta/
```

---

## 6. Implementation Details

### Markdown Rendering

`markdown-it` with custom plugins for all 8 `[[wikilink]]` syntax types from the spec. Source references (`[[src:...]]`) render as collapsible code blocks with syntax highlighting. Function references preferred over line references.

### SSE (Server-Sent Events)

Single SSE endpoint at `/api/sse`. Event types: `page-changed`, `feed-updated`, `plan-status-changed`. Each event carries the affected page slug so the client only re-fetches what changed. Browser reconnects automatically on disconnect.

### Agent Integration

All agents use the Anthropic SDK directly:
- **Haiku watcher:** `claude-haiku-4-5-20251001` — lightweight, always-on interpretation
- **Planning agent:** `claude-sonnet-4-6` — on-demand, produces structured plans
- **Execution agent:** `claude-sonnet-4-6` — background, executes approved plans
- **Chat-in-page agent:** `claude-sonnet-4-6` — single-turn page editing

Agent calls are async — the server doesn't block on them.

### Loop Prevention

Three overlapping guards:
1. **Frontmatter origin tag** — `last-modified-by: agent` suppresses Haiku interpretation (not SSE)
2. **Write lock** — `agent-writing.lock` acquired before agent write, released after
3. **Directory separation** — watcher monitors `/wiki/pages/` and `/wiki/meta/` (user-facing). Agent output goes to `/wiki/.meta/` (hidden), which is not watched. Edits to `meta/inbox.md` trigger plan approval detection, not Haiku interpretation.

### Tag Auto-Apply

Haiku applies tag suggestions directly to page frontmatter. Each application is logged to `.meta/pages/<page>.json` with the previous tag set, enabling undo.

### qmd Integration

Shell out via `Bun.spawn()` to `qmd` CLI. BM25 index updated on every watcher trigger (`qmd update`). Vector embeddings refreshed only when Haiku marks a change as significant (`qmd embed`, background).

### Planning Agent Context (Two-Tier Retrieval)

1. Send all page summaries (from frontmatter) upfront
2. Agent requests full page content for specific pages as needed
3. qmd search results for each change summary included

### Add Page Flow

`POST /api/pages` receives: user notes (textarea content), optional category, optional related page slugs.

1. Agent reads user notes + summaries of related pages (if provided)
2. Infers filename (kebab-case from title), title, category, initial tags
3. Writes structured page with proper frontmatter to `/wiki/pages/`
4. Preserves user's raw notes verbatim under a `## Notes` section
5. Returns the new page slug to the client for navigation
6. Watcher picks up the new file on next cycle — generates summary, updates backlinks and qmd index

### Execution Agent Branching Model

The execution agent works on a dedicated git branch:
- Branch naming: `octowiki/plan-YYYY-MM-DD-NNN`
- Agent commits incrementally as it works
- On success: plan status set to `done` in `inbox.md`, branch is ready for user to review and merge
- On failure: plan status set to `failed`, partial work preserved on branch
- Branch cleanup is manual — user decides when to merge or delete
- The main branch is never modified directly by the execution agent

### Lock Concurrency

The `.lock` file is exclusive. Only one agent write operation can proceed at a time:
- Before writing, agent attempts to create `agent-writing.lock` with its PID
- If lock exists and PID is alive, the write is queued (in-memory, up to 10s timeout)
- If lock exists and PID is dead, lock is cleaned up and acquired
- Lock is released immediately after the file write completes
- Chat and execution agent writes go through the same lock — serialised, not parallel

### Frontend Routing

The React SPA uses client-side routing (React Router):
- `/` — redirects to first page or shows page list
- `/page/:slug` — `PageView` with `ChatBox` fixed at bottom, `PageList` sidebar persists
- `/feed` — `ChangesFeed` panel (can also be accessed as a sidebar overlay)
- `/inbox` — `Inbox` view showing pending/approved/done plans
- `/search?q=...` — search results page

State management: React Query for server state (pages, feed, inbox). SSE events invalidate relevant queries to trigger re-fetches.

---

## 7. Error Handling

### Watcher Resilience
- Haiku call failure: log error, skip summary, retry on next edit
- qmd CLI not installed: start without search, log warning with install instructions
- Stale `.lock` file: detect via PID check, clean up on startup

### Chat Failures
- Agent call failure: return error to client, page is never written (no partial edits)
- Race condition (page modified between request and response): re-read page, retry once

### Execution Agent Failures
- Writes to a git branch; partial work preserved on branch for manual inspection
- Plan status in `inbox.md` set to `failed` with error summary

---

## 8. Testing Strategy

- **Unit tests** (Bun test): frontmatter parsing, wikilink parsing, backlinks computation, debounce logic, lock management
- **Integration tests**: watcher → Haiku pipeline (mock Anthropic API), chat flow end-to-end, plan approval → execution flow
- **No e2e browser tests for v1** — test the API layer, trust React components to render correctly

---

## 9. Key Types

```typescript
interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  lastModifiedBy: "user" | "agent";
  content: string; // full markdown body (excluding frontmatter)
}

interface ChangeSummary {
  id: string;
  timestamp: string;
  page: string;
  tags: string[];
  summary: string;
  affectedPages: string[];
  rawDiff: string;
}

interface Plan {
  id: string; // plan-YYYY-MM-DD-NNN
  title: string;
  status: "pending" | "approved" | "rejected" | "done" | "failed";
  summary: string;
  steps: PlanStep[];
  error?: string;
}

interface PlanStep {
  description: string;
  target: string; // file path or page slug
  action: "create" | "update" | "delete";
}

interface ChatExchange {
  timestamp: string;
  role: "user" | "agent";
  message: string;
  pageDiff?: string;
}
```

---

## 10. Deferred to Future Versions

The following features from the system spec are intentionally deferred:

- **Bootstrapping plugin (spec Section 11):** Claude Code plugin that derives a wiki from an existing codebase. Will be built as a separate package after the core system is stable. No architectural decisions needed now — it's a one-shot import tool.
- **Desktop Extension / .mcpb (spec Section 12):** Packaging as a Claude Desktop Extension. The standalone CLI-first approach (OQ-13) means this is a wrapper layer added later. The MCP tool interface maps directly to existing API routes.
- **Git reference validation hooks (spec Section 10):** Post-commit hooks that verify `[[src:...]]` references. Requires the wiki to be populated first. Will be added as a git hook installer command.
- **Monorepo / multi-repo support (spec Section 11, OQ-11):** Single repo only for v1.
