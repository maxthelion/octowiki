---
title: "OctoWiki Overview"
category: "architecture"
tags: [getting-started, setup, configuration, usage]
summary: "Project overview, prerequisites, quick start guide, and usage instructions for OctoWiki."
last-modified-by: agent
---

## What is OctoWiki?

OctoWiki is an AI-powered wiki for codebases. It watches your markdown pages, summarises changes with Claude, and lets you chat with pages, plan cross-wiki edits, and execute them autonomously. See the [[wiki-agent-system-spec]] for the full system specification.

## Prerequisites

- [Bun](https://bun.sh) v1.3+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) [qmd](https://github.com/qmd/qmd) for search and embeddings

## Quick Start

```bash
bun install
bun run build:web
export ANTHROPIC_API_KEY=sk-ant-...
bun run dev
```

Open http://localhost:4567 in your browser.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | -- | Required. Anthropic API key |
| `OCTOWIKI_DIR` | `./wiki` | Wiki content directory path |
| `PORT` | `4567` | HTTP server port |

## Project Structure

- `src/` -- Backend (Bun + Hono): server, agents, watcher, wiki core, search
- `web/` -- Frontend (React + Vite): components, hooks, markdown renderer
- `wiki/` -- Wiki content: pages, meta, and agent data

For detailed module layout, see [[design-spec]]. For Bun conventions, see [[project-config]].

## How It Works

### Pages

Create markdown files in `wiki/pages/` with YAML frontmatter (title, category, tags, summary, last-modified-by). Link between pages using `[[page-slug]]` wikilinks. OctoWiki supports 8 wikilink types including page links, embeds, source references, and external refs.

### File Watcher

Dual debounce system: 2s for browser SSE updates, 30s idle for Haiku interpretation. See [[design-spec]] for the full debounce model.

### Chat

Each page has a fixed-bottom chat box. Messages go to Claude Sonnet, which edits the page directly. Last 10 exchanges provide context.

### Planning and Execution

1. Review changes in the Feed panel
2. Select changes and click "Plan this"
3. Review plans in the Inbox
4. Approve -- execution agent runs on a git branch (`octowiki/plan-YYYY-MM-DD-NNN`)
5. Review the branch and merge when ready

The full pipeline is described in [[wiki-agent-system-spec]] and the implementation details are in [[design-spec]].

## Development

```bash
bun run dev          # Backend with auto-restart
bun run dev:web      # Frontend dev server (proxies API to port 4567)
bun test             # Run tests
```

## Search

If qmd is installed, BM25 and vector search are available via `GET /api/search?q=...&mode=bm25|vector|hybrid`. Without qmd, the server starts normally but search is unavailable.

## Tests

34 tests covering frontmatter parsing, wikilink parsing, page CRUD, backlinks, lock management, qmd command building, API routes, and debounce logic. See [[implementation-plan]] for the full testing strategy.
