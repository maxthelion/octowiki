# OctoWiki

An AI-powered wiki for codebases. OctoWiki watches your markdown pages, summarises changes with Claude, and lets you chat with pages, plan cross-wiki edits, and execute them autonomously.

## Prerequisites

- [Bun](https://bun.sh) (v1.3+)
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) [qmd](https://github.com/qmd/qmd) for search/embeddings

## Quick Start

```bash
# Install dependencies
bun install

# Build the frontend
bun run build:web

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the server
bun run dev
```

Open http://localhost:4567 in your browser.

## Project Structure

```
octowiki/
├── src/                    ← Backend (Bun + Hono)
│   ├── index.ts            ← Entry point
│   ├── server/             ← HTTP server, routes, SSE
│   ├── agents/             ← Claude agent integrations
│   ├── watcher/            ← File watcher with dual debounce
│   ├── wiki/               ← Core: pages, frontmatter, wikilinks, backlinks
│   └── search/             ← qmd CLI bridge
├── web/                    ← Frontend (React + Vite)
│   └── src/
│       ├── components/     ← PageView, ChatBox, Feed, Inbox, etc.
│       ├── hooks/          ← React Query + SSE hooks
│       └── lib/            ← Markdown renderer, tree builder, utilities
└── wiki/                   ← Your wiki content (created on first run)
    ├── pages/              ← Markdown pages
    ├── meta/               ← taxonomy.md, inbox.md
    └── .meta/              ← Agent data (queue, backlinks, plans)
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key |
| `OCTOWIKI_DIR` | `./wiki` | Path to the wiki content directory |
| `PORT` | `4567` | HTTP server port |

## Development

```bash
# Run backend (auto-restarts on changes)
bun run dev

# Run frontend dev server (with hot reload, proxies API to backend)
bun run dev:web

# Run tests
bun test
```

When using `dev:web`, the Vite dev server proxies `/api` requests to the backend on port 4567. Run both commands in separate terminals for the full dev experience.

## How It Works

### Pages

Create markdown files in `wiki/pages/` with YAML frontmatter:

```markdown
---
title: My Page
category: architecture
parent: system-architecture
overview: true
tags: [api, design]
summary: ""
last-modified-by: user
---

Your content here. Link to other pages with [[page-slug]] syntax.
```

- **`parent`** (optional): slug of a parent page in the same category. Creates nested hierarchy in the sidebar.
- **`overview`** (optional): if `true`, the page sorts first at its level in the sidebar tree.

### Sidebar Navigation

Pages are grouped by category in a collapsible tree. Categories are loaded dynamically from `wiki/pages/category-taxonomy.md`. Pages can nest under other pages using the `parent` frontmatter field, creating a multi-level hierarchy. Each node with children can be independently collapsed/expanded, and navigating to a nested page auto-expands its ancestor chain.

### Wikilinks

OctoWiki supports 8 wikilink types:

| Syntax | Description |
|--------|-------------|
| `[[page-slug]]` | Link to a page |
| `[[!page-slug]]` | Embed a page |
| `[[!!page-slug]]` | Full embed |
| `[[src:file.ts#function]]` | Source code reference |
| `[[ref:git:abc123]]` | Git ref |
| `[[ref:pr:42]]` | Pull request ref |
| `[[ref:doc:spec.md]]` | Document ref |
| `[[ref:test:test-name]]` | Test ref |

### File Watcher

The watcher monitors `wiki/pages/` and `wiki/meta/` with two debounce timers:
- **2 seconds**: pushes SSE notifications so the browser re-renders
- **30 seconds idle**: triggers Haiku to summarise changes, update backlinks, suggest tags

### Chat

Each page has a chat box at the bottom. Messages are sent to Claude (Sonnet), which edits the page content directly. Chat history (last 10 exchanges) provides context.

### Planning & Execution

1. Review changes in the **Feed** panel
2. Select changes and click **"Plan this"** to trigger the planning agent
3. Review plans in the **Inbox**
4. Approve a plan — the execution agent runs it on a git branch (`octowiki/plan-YYYY-MM-DD-NNN`)
5. Review the branch and merge when ready

## Search

If `qmd` is installed, OctoWiki provides BM25 and vector search via `GET /api/search?q=...&mode=bm25|vector|hybrid`. The index updates automatically when pages change. Without qmd, the server starts normally but search is unavailable.

## Tests

```bash
bun test
```

83 tests covering frontmatter parsing, wikilink parsing, page CRUD, backlinks, lock management, qmd command building, API routes, taxonomy parsing, tree building, and debounce logic.
