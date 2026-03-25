---
title: Agent Integration
category: architecture
parent: system-architecture
tags: [agents, pipeline, claude, orchestration, reactive-system]
summary: "OctoWiki integrates four specialised Claude agents — Haiku Watcher, Planning, Execution, and Chat-in-Page — coordinated through a staged reactive pipeline with explicit human approval gates."
last-modified-by: agent
---

## Overview

OctoWiki coordinates four specialised Claude agents to provide automated wiki maintenance and improvement. Each agent has a narrow, well-defined role. They communicate through shared files — a change feed (`queue.json`), a plan inbox (`inbox.md`), and structured JSON plans — rather than calling each other directly. All Anthropic SDK calls are fully asynchronous with no polling.

The pipeline is designed to keep humans in the loop at the point where consequential decisions are made: a lightweight agent interprets changes cheaply and immediately, a more capable agent proposes multi-step plans, and no execution happens until a human approves.

## Agent Roles

### Haiku Watcher Agent

**Model:** `claude-haiku-4-5-20251001`

The lightest and most frequently triggered agent. It is always on and reacts to file changes in `/wiki/pages/*.md` — but only when the page's frontmatter carries `last-modified-by: user`. This prevents it from reacting to its own or other agents' writes.

After a debounce window (approximately 2 seconds after the last change), it:

1. Extracts wikilinks and updates `backlinks.json`
2. Refreshes the BM25 search index via `qmd update`
3. Compares page content against the existing summary to produce a semantic change summary (not a raw diff)
4. Suggests tag updates against `taxonomy.md`
5. Appends a `ChangeSummary` record to `queue.json`
6. Schedules a background vector embedding refresh (`qmd embed`) if the change is significant

The Haiku Watcher does not plan, execute, or write wiki pages. It is a pure interpreter.

### Planning Agent

**Model:** `claude-sonnet-4-6`

Spun up on demand when a user selects one or more change summaries from the Changes Feed UI and clicks "Plan this". It is not always-on; it exits after producing a plan.

It receives:
- The selected `ChangeSummary` records
- All wiki page summaries (upfront) and the ability to request full page content on demand (two-tier retrieval)
- `backlinks.json`
- `taxonomy.md`
- Top-k relevant pages from `qmd` semantic search for each selected change

It produces:
- A human-readable plan entry appended to `inbox.md` with status `pending`
- A full structured plan JSON written to `/.meta/plans/`

Example plan entry in `inbox.md`:

```markdown
## Plan 2026-03-12-001 — Road network density refactor
*Status: pending*

Settlement density now drives road spacing. Proposed changes:
- Update `arterial-roads.ts` — recalculate spacing from density field
- Update `blocks.md` — note revised subdivision constraint
- Add regression test for water boundary case

[Full plan details](.meta/plans/plan-2026-03-12-001.json)
```

The user approves or rejects a plan by editing the `Status:` line directly. The Haiku Watcher detects this as a user edit and routes approved plans to the Execution Agent.

### Execution Agent

**Model:** `claude-sonnet-4-6`

Runs in the background on a dedicated git branch (`octowiki/plan-YYYY-MM-DD-NNN`). It is triggered when the Haiku Watcher detects a plan status change to `approved`.

It reads the full plan JSON from `/.meta/plans/` and executes each step sequentially. All writes are marked `last-modified-by: agent` in frontmatter and protected by a write lock (`agent-writing.lock`). It commits incrementally as work progresses.

On success: plan status in `inbox.md` is updated to `done`, per-page action logs are written to `.meta/pages/*.json`, and the branch is ready for merge. On failure: status is set to `failed` and partial work is preserved on the branch.

The main branch is never directly modified by the Execution Agent.

### Chat-in-Page Agent

**Model:** `claude-sonnet-4-6`

A single-turn agent invoked when a user sends a message through the inline chat interface on a wiki page. It operates asynchronously from the server (non-blocking), acquires the write lock before making any changes, appends the exchange to `.meta/pages/<page>.json`, and then exits. It handles exactly one message-edit cycle per invocation.

## Pipeline Orchestration

The full flow from edit to execution:

```
User edits a wiki page
  ↓
Haiku Watcher Agent (debounced, immediate)
  → Summarise + tag page
  → Update backlinks and search index
  → Append to queue.json
  → SSE: feed-updated
  ↓
User reviews Changes Feed, selects summaries
User clicks "Plan this"
  ↓
Planning Agent (on-demand)
  → Analyse selected changes
  → Generate multi-step plan
  → Append to inbox.md (status: pending)
  → SSE: plan-status-changed
  ↓
User edits inbox.md: Status: approved
  ↓
Haiku Watcher detects status change
  ↓
Execution Agent (background, dedicated branch)
  → Execute plan steps sequentially
  → Update affected pages
  → Commit incrementally
  → Update plan status to done/failed
  → SSE: page-changed (per modified page)
```

## Loop Prevention

Three overlapping guards prevent agents from triggering each other in feedback loops:

1. **Frontmatter origin tag** — `last-modified-by: agent` suppresses the Haiku Watcher trigger on files the agent has written
2. **Write lock** — `agent-writing.lock` exists on disk during any agent write operation; the watcher will not start a new run while the lock is present
3. **Directory isolation** — the Haiku Watcher only monitors `/wiki/pages/`; agents also write to `/.meta/` and `/.index/`, which are outside the watch scope

## Concurrency and Error Handling

The write lock ensures only one agent writes to the wiki at a time, preventing races between concurrent agent runs and between agent writes and user edits.

Each agent has timeout protection and retry logic. Errors are recorded in the `Plan.error` field rather than failing silently; users are notified through the inbox rather than having failures disappear.

## Key Design Constraints

- **No agent-to-agent calls** — coordination is file-based; agents read and write shared JSON/markdown files
- **Human approval is mandatory** before any execution; the Planning Agent cannot self-approve
- **Branch isolation** — execution work is always on a feature branch, never directly on `main`
- **Model selection is intentional** — Haiku for always-on low-cost interpretation, Sonnet for reasoning-heavy planning and execution

## Related Pages

- [[skills]] — the batch-import and add-page skills that also invoke agents
- [[sidebar-tree-navigation]] — the UI that surfaces the Changes Feed and inbox to users
- [[bootstrapping]] — the initial wiki population process, which uses a related multi-agent pipeline
