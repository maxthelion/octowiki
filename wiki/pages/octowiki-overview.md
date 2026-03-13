---
title: OctoWiki Overview
category: functionality
tags: [octowiki, wiki, ai, getting-started, architecture]
summary: "OctoWiki is an AI-powered wiki for codebases that combines real-time file watching, a chat interface, agent-driven planning, and semantic search into a single Bun process."
last-modified-by: agent
---

## What is OctoWiki?

OctoWiki is an AI-powered wiki designed for codebases. It stores knowledge as markdown files with YAML frontmatter, watches them for changes, and runs a suite of Claude-powered agents that summarise edits, plan improvements, and execute those plans autonomously.

The system is built as a single Bun process — a Hono HTTP server, file watcher, agent orchestrator, and React frontend all in one.

## Key Capabilities

- **Automatic change summarisation** — a Haiku-powered watcher agent detects page edits, summarises what changed, and updates tags
- **Chat interface** — chat directly on any page to have Claude edit its content in place
- **Cross-wiki planning** — a planning agent consumes change events and generates multi-step improvement plans, routed to an inbox for approval
- **Autonomous execution** — approved plans are executed by an execution agent that applies diffs to pages and commits via git branches
- **Real-time updates** — the browser receives live page changes via Server-Sent Events (SSE)
- **Search** — optional BM25 and vector search via the `qmd` CLI
- **Wikilinks** — pages can reference each other with `[[wikilinks]]`, support embeds, source code references, and git/PR/doc/test links

## Getting Started

### Prerequisites

- **Bun** v1.3 or later
- **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com/)
- **qmd** (optional) — for semantic search and embeddings

### Installation

```bash
bun install
bun run build:web
```

### Configuration

Set your API key in a `.env` file or as an environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Bun loads `.env` automatically — no additional configuration needed.

### Running

```bash
bun run dev
```

The server starts on [http://localhost:4567](http://localhost:4567).

## How It Works

Wiki pages live in `wiki/pages/` as `.md` files with YAML frontmatter. A file watcher monitors changes with dual debounce (immediate fire + delayed batch). Changed files are picked up by the Haiku watcher agent, which summarises the delta and feeds a change event into the planning pipeline.

The planning agent generates structured improvement plans, which appear in the inbox. Once a plan is approved, the execution agent applies the changes, creating diffs and committing via git.

The frontend is a React SPA that connects to the Hono backend over SSE for live updates. Pages are rendered with `markdown-it` extended with a custom wikilink plugin. See [[sidebar-tree-navigation]] for how pages are organised in the UI.

## Page Structure

Every page is a markdown file with YAML frontmatter. The required fields are:

```yaml
---
title: Page Title
category: functionality
tags: [tag-one, tag-two]
summary: One-sentence description of the page.
last-modified-by: user
---
```

Pages are classified into categories defined in [[category-taxonomy]]. Use `[[wikilinks]]` to cross-reference related pages rather than duplicating content — see [[content-guidelines]] for the full rules.

## Skills and Automation

OctoWiki ships with Claude Code skills for common operations:

- **`/octowiki:add-page`** — creates a new wiki page using the [[category-taxonomy]] to pick the right category
- **`/octowiki:batch-import`** — imports documentation from an external repo: discovers markdown files, extracts topics with Haiku, groups and deduplicates them, synthesises pages with Sonnet, and stages everything for preview before applying

See [[skills]] for full usage details and [[bootstrapping]] for how the wiki was initially populated.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Language | TypeScript |
| HTTP server | Hono |
| Frontend | React + React Router + React Query |
| Markdown | markdown-it |
| AI | Anthropic SDK (Claude Haiku + Sonnet) |
| Search | qmd CLI (optional) |

## Related Pages

- [[category-taxonomy]] — canonical category definitions used to classify pages
- [[content-guidelines]] — rules for writing wiki content without duplication
- [[skills]] — automation tools including `add-page` and `batch-import`
- [[bootstrapping]] — how the wiki was initially populated from source docs
- [[sidebar-tree-navigation]] — how pages are displayed and navigated in the UI
- [[agent-activity-indicator]] — how the UI surfaces live agent activity
