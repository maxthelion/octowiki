---
title: Desktop Extension (MCP) Interface
category: architecture
parent: system-architecture
tags: [mcp, integration, desktop-extension, tools]
summary: The wiki system is packaged as a Claude Desktop Extension (.mcpb) that exposes a set of MCP tools to Claude and manages the local processes required to serve the wiki.
last-modified-by: agent
---

## Overview

The wiki system is distributed as a Claude Desktop Extension in `.mcpb` (MCP Bundle) format. This packaging gives Claude in Claude Desktop direct, structured access to wiki content and operations through a set of named MCP tools, while also managing the lifecycle of the local processes the wiki depends on.

This architecture means a single installation step is all that is required for a user to have a fully functional, locally-running wiki integrated into their Claude conversations.

## MCP Tools Exposed

The extension registers the following tools with Claude Desktop:

| Tool | Description |
|------|-------------|
| `wiki_search(query, mode)` | Search the wiki using BM25, semantic, or hybrid mode |
| `wiki_get(page)` | Retrieve the full content of a named page |
| `wiki_edit(page, content)` | Write a page (sets `last-modified-by: agent` in frontmatter) |
| `wiki_list()` | List all pages with their summaries drawn from frontmatter |
| `wiki_get_changes_feed()` | Retrieve pending change summaries from the change queue |
| `wiki_get_inbox()` | Retrieve pending plans from `inbox.md` |
| `wiki_approve_plan(plan_id)` | Approve a queued plan for execution |

These tools are the primary interface through which Claude interacts with the wiki — reading pages for context, editing pages in response to user requests, and approving agent-generated plans. See [[skills]] for the higher-level skills built on top of these primitives.

## Local Processes Managed

The extension is responsible for starting and supervising the local processes that the wiki system requires:

- **Wiki web server** — serves the renderer UI and the chat API
- **File watcher + Haiku reactor** — monitors `/wiki/pages/*.md` for changes and triggers reactive updates
- **qmd index** — maintains BM25 and vector embeddings for search
- **Git hooks** — post-commit reference validation to keep wikilinks consistent

By managing these processes inside the extension bundle, the user does not need to manually start or configure any background services.

## Component Relationships

The extension sits at the boundary between Claude Desktop and the rest of the wiki system:

```
Claude Desktop
    └── MCP Extension (.mcpb)
            ├── MCP tool handlers
            ├── Wiki web server
            ├── File watcher + Haiku reactor
            ├── qmd index (BM25 + vector)
            └── Git hooks
```

The MCP tool handlers translate Claude's tool calls into operations on the local wiki files and processes. The [[sidebar-tree-navigation]] and renderer UI are served by the wiki web server managed within this same bundle.

## Design Constraints and Trade-offs

**Single installation step** — bundling everything into `.mcpb` makes setup trivial but means the extension carries significant responsibility for process management and error recovery.

**Local-first** — all data and processes run on the user's machine. There is no remote server. This gives privacy and offline capability but means the extension must handle process lifecycle robustly.

**Standalone capability** — the wiki system is useful independently of Claude Desktop (e.g. browsing via the web UI, editing files directly). Whether to also support a standalone CLI mode is an open question; the current architecture does not preclude it.

## Related

- [[skills]] — higher-level automation tools built on the MCP tool interface
- [[sidebar-tree-navigation]] — the renderer UI served by the wiki web server
- [[bootstrapping]] — the process for initially populating a wiki, which uses the same `wiki_edit` tool path
