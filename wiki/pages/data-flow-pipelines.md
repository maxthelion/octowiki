---
title: Data Flow Pipelines
category: pipeline
tags: [pipeline, dataflow, agents, events]
summary: "The four primary data flows in OctoWiki — user edits, chat-driven page edits, plan approval execution, and planning triggers — each describing how information moves from input through processing to output."
last-modified-by: agent
---

## Overview

OctoWiki implements four primary data flow pipelines. Each pipeline has a distinct trigger, a sequence of processing steps, and produces observable output — typically a page edit and an SSE push to connected browsers. Understanding these pipelines is essential for tracing how a user action propagates through the system.

All pipelines share a common pattern: a trigger event → guard checks → agent or server processing → disk write → SSE notification → browser re-render.

---

## Pipeline 1: User Edit → Haiku Interpretation

**Trigger:** A user saves a `.md` file directly.

**Steps:**
1. `fs.watch` detects the file change.
2. Guards are checked: `last-modified-by` must not be `agent`, and no `.lock` file may exist (to avoid reacting to agent-driven writes).
3. After a **2-second debounce**, an SSE push is sent so the browser re-renders the updated content immediately.
4. After **30 seconds of idle time**, a Haiku interpretation pass runs:
   - Updates backlinks and the `qmd` index.
   - Schedules `qmd` embedding updates if the change is significant.
   - Auto-applies tag suggestions, logging any changes for undo.
   - Appends a change summary to `queue.json`.
   - Pushes a `feed-updated` SSE event.

**Error handling:** The `.lock` file guard prevents the pipeline from triggering on agent writes, avoiding feedback loops.

**Dependencies:** `fs.watch`, the `qmd` index, `queue.json`, the SSE event system.

---

## Pipeline 2: Chat Message → Page Edit

**Trigger:** A user types a message in the chat box and submits it, POSTing to `/api/chat/:page`.

**Steps:**
1. The server loads the current page content, the last 10 history entries from `.meta/pages/<page>.json`, and relevant `qmd` search results.
2. An agent edits the page: it sets `last-modified-by: agent` and acquires a `.lock` file before writing.
3. The updated content is written to disk; the `.lock` is released.
4. The exchange (user message + agent response) is appended to `.meta/pages/<page>.json`.
5. An SSE push is sent **directly** (bypassing the debounce used in Pipeline 1).
6. The browser re-renders.

**Key distinction from Pipeline 1:** Because the agent sets `last-modified-by: agent` and holds a `.lock`, Pipeline 1's `fs.watch` handler will skip this change, preventing a duplicate interpretation pass.

**Dependencies:** `/api/chat/:page` endpoint, `.meta/pages/` history store, `qmd` search, SSE event system.

---

## Pipeline 3: Plan Approval → Execution

**Trigger:** A user clicks **Approve** on a plan in the Inbox, POSTing to `/api/inbox/:planId/approve`.

**Steps:**
1. `inbox.md` is updated: the plan's status changes from `pending` → `approved`.
2. The execution agent picks up the plan's JSON from `.meta/plans/`.
3. The agent executes the plan on a dedicated git branch: `octowiki/plan-YYYY-MM-DD-NNN`.
4. On success: status is updated to `done`.
5. On failure: status is updated to `failed` with an error summary written alongside.
6. An SSE push with event `plan-status-changed` is sent.

**Error handling:** Failures are recorded with a summary rather than silently discarded, and the branch is preserved for inspection.

**Dependencies:** `/api/inbox/:planId/approve`, `inbox.md`, `.meta/plans/`, git branching, SSE event system.

---

## Pipeline 4: Planning Trigger

**Trigger:** A user selects one or more change summaries from the feed and clicks **Plan this**, POSTing to `/api/plan`.

**Steps:**
1. The planning agent receives: the selected change summaries, all page summaries, `backlinks.json`, `taxonomy.md`, and `qmd` search results.
2. The agent requests full page content as needed using a **two-tier loading strategy** (summaries first, full content on demand).
3. The agent produces a plan entry written to both `inbox.md` (for display) and `.meta/plans/` (for execution).
4. An SSE push with event `plan-status-changed` is sent so the Inbox updates immediately.

**Dependencies:** `/api/plan` endpoint, `backlinks.json`, [[category-taxonomy]], `qmd` search, `inbox.md`, `.meta/plans/`, SSE event system.

---

## Cross-Pipeline Concerns

### SSE Event System

All four pipelines use Server-Sent Events to notify connected browsers of state changes. Pipeline 1 sends `feed-updated`; Pipelines 3 and 4 send `plan-status-changed`; Pipeline 2 sends a direct re-render event. The browser re-renders in response to each.

### Lock and Authorship Guards

The `.lock` file and `last-modified-by` frontmatter field together prevent pipelines from triggering each other. Agent writes set both; Pipeline 1 checks both before proceeding.

### The `.meta/` Directory

Persistent state that crosses pipeline boundaries — page history, plan JSON, the `qmd` index — is stored under `.meta/`. This directory is not served to users directly but is read by agents and the server across all four pipelines.
