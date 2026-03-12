---
title: "Wiki Agent System Specification"
category: "architecture"
tags: [wiki, agents, architecture, reactive-pipeline, wikilinks, search, bootstrapping]
summary: "The foundational spec (v0.1) defining OctoWiki's core concepts: wiki-as-source-of-truth, chat-in-page, reactive agent pipeline, and codebase-as-derived-output."
last-modified-by: agent
---

## Overview

OctoWiki is a local wiki system where the wiki describes a software project and the codebase is a derived product of it. Agents react to wiki changes, and the system combines file-based markdown pages, embedded chat-in-page, a reactive agent pipeline, and semantic search into a unified interface for human-agent collaborative development.

For the concrete implementation choices derived from this spec, see [[design-spec]]. For the step-by-step build plan, see [[implementation-plan]].

## Core Concepts

### Wiki as Source of Truth

The wiki describes the system; code is downstream. When a wiki page changes, agents infer consequences for the codebase. Pages are plain markdown files on disk, readable without the system running.

### Chat-in-Page

Each page has an embedded text box. Messages are scoped to the page context. The agent responds by editing the page directly (optimistic edit model). There is no separate chat transcript -- the conversation materialises as document changes.

### Reactive Agent Pipeline

A file watcher monitors page changes and triggers a lightweight Haiku agent to interpret them. Haiku accumulates interpreted change summaries into a queue. The user selects changes from a feed and triggers a planning agent. Approved plans are executed in the background.

### Codebase as Derived Output

Code is generated from, and validated against, the wiki. Source references in wiki pages are checked on git commit.

## File Structure

```
/wiki
  /pages/              -- user-editable markdown pages (watched)
  /.meta/
    /pages/*.json      -- per-page chat history + agent action log
    /plans/            -- structured plan objects
    queue.json         -- Haiku's accumulated change queue
    backlinks.json     -- maintained by watcher
    agent-writing.lock -- write guard (prevents watcher loops)
  /.index/
    qmd/               -- BM25 + embeddings index
  /meta/
    taxonomy.md        -- canonical categories, tags
    inbox.md           -- pending plans
```

## Page Features

Pages use YAML frontmatter (title, category, tags, summary, last-modified-by). OctoWiki defines 8 wikilink syntax types:

- `[[page-name]]` -- link with hover summary
- `[[!page-name]]` / `[[!!page-name]]` -- embed (summary or full)
- `[[src:file.ts#functionName]]` -- source reference (collapsible code block)
- `[[ref:git:...]]`, `[[ref:pr:...]]`, `[[ref:doc:...]]`, `[[ref:test:...]]` -- external references

Function references are preferred over line references as they survive refactors.

## Agent Architecture

**Haiku Watcher** -- always-on, lightweight reactor. Triggers on user edits (debounced ~2s). Extracts wikilinks, updates backlinks, refreshes BM25 index, produces interpreted change summaries. Does not plan or execute.

**Changes Feed** -- UI panel showing Haiku's summaries. Users select changes and trigger planning.

**Planning Agent** -- spun up on demand, receives selected changes + full wiki context + search results. Produces a human-readable plan in `inbox.md` plus a structured plan JSON.

**Execution Agent** -- runs approved plans in the background. Writes to codebase and wiki (with `last-modified-by: agent`).

### Loop Prevention

Three overlapping guards: (1) frontmatter origin tag, (2) write lock file, (3) directory separation (watcher only monitors `/wiki/pages/`).

## Taxonomy System

Categories are structural (one per page): architecture, pipeline, data-model, rendering, testing, observability, decisions, meta. Tags are cross-cutting and maintained in `taxonomy.md`. Haiku suggests and flags tag changes against the canonical vocabulary.

## Bootstrapping

A Claude Code plugin derives an initial wiki from an existing codebase via four passes: structural (skeleton), semantic (content), historical (git evolution), and contradiction detection.

## Open Questions

The spec contains 14 open questions covering agent write access, chat history windowing, Haiku trigger thresholds, search strategy, UI layout, bootstrapping depth, and deployment packaging. These are resolved in [[design-spec]].
