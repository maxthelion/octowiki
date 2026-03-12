# Wiki Agent System — Specification

**Status:** Draft v0.1  
**Author:** Max (via Claude)  
**Date:** 2026-03-12

---

## 1. Overview

A local wiki system where a living document describes a software project, agents react to changes, and the codebase is a derived product of the wiki rather than the primary artefact. The system combines a file-based wiki, embedded chat-in-page, a reactive agent pipeline, and semantic search into a unified interface for human-agent collaborative development.

---

## 2. Core Concepts

### 2.1 The Wiki as Source of Truth

The wiki describes the system. Code is downstream of it. When a wiki page changes, agents infer consequences for the codebase — not the reverse.

Pages are plain markdown files on disk, editable by both humans and agents. The wiki is always readable without the system running (in an editor, on GitHub, etc.).

### 2.2 Chat-in-Page

Each wiki page has an embedded text box. Messages sent from this box are scoped to the page context. The agent responds by editing the page directly (optimistic edit model). There is no separate chat transcript — the conversation is materialised as changes to the document.

### 2.3 Reactive Agent Pipeline

A file watcher monitors page changes and triggers a lightweight Haiku agent to interpret them. Haiku does not plan or execute — it accumulates interpreted change summaries into a queue. The user selects changes from a feed and triggers a more capable planning agent. Approved plans are executed in the background.

### 2.4 The Codebase as Derived Output

Code is generated from, and validated against, the wiki. Source references in wiki pages are checked on git commit. The bootstrapping process derives an initial wiki from an existing codebase.

---

## 3. File Structure

```
/wiki
  /pages/                        ← user-editable markdown pages (watched)
    *.md
  /.meta/
    /pages/
      *.json                     ← per-page chat history + agent action log
    /plans/
      plan-YYYY-MM-DD-NNN.json   ← full structured plan objects
    queue.json                   ← haiku's accumulated change queue
    backlinks.json               ← maintained by watcher
    agent-writing.lock           ← write guard (prevents watcher loops)
  /.index/
    qmd/                         ← qmd collection index (BM25 + embeddings)
  /meta/
    taxonomy.md                  ← canonical categories, tags, descriptions
    inbox.md                     ← pending plans, user edits status here
```

### 3.1 Page Frontmatter

```yaml
---
title: Road Network Generation
category: pipeline
tags: [road-network, frontier-expansion, performance]
summary: "Describes the priority-queued frontier expansion algorithm for
  arterial road generation. Depends on terrain heightmap and settlement
  density fields. Open question around dead-end constraint near water."
last-summarised: 2026-03-12T14:23:00
last-modified-by: user          # or: agent
---
```

---

## 4. Page Features

### 4.1 Link Syntax

| Syntax | Behaviour |
|--------|-----------|
| `[[page-name]]` | Link — hover shows summary tooltip |
| `[[!page-name]]` | Embed — renders title + summary inline |
| `[[!!page-name]]` | Embed — renders full page content inline |
| `[[src:file.ts#functionName]]` | Source reference by function |
| `[[src:file.ts#142-167]]` | Source reference by line range |
| `[[ref:git:abc123f]]` | Reference to a specific commit |
| `[[ref:pr:47]]` | Reference to a pull request |
| `[[ref:doc:README.md#section]]` | Reference to existing documentation |
| `[[ref:test:road.test.ts#L42]]` | Reference to a test |

### 4.2 Source References

Source references render as collapsible inline code blocks with syntax highlighting. Hovering shows function signature and docstring. Clicking expands the full block in place.

Function references (`#functionName`) are preferred over line references (`#142-167`) as they survive most refactors.

### 4.3 Hover Summaries

Hovering over any `[[page-name]]` link shows the Haiku-maintained summary for that page. Hovering over backlink entries in the backlinks panel also shows the referring page's summary.

### 4.4 References Block

Each bootstrapped page includes a collapsible references section listing every source used to derive its content, with timestamps or commit SHAs.

---

## 5. Agent Architecture

### 5.1 Haiku Watcher Agent

**Role:** Always-on, lightweight reactor.

**Triggers:** Any change to `/wiki/pages/*.md` where `last-modified-by: user`.

**Does not trigger on:**
- Files with `last-modified-by: agent` in frontmatter
- Any file in `/.meta/` or `/.index/`
- Changes while `agent-writing.lock` exists

**On trigger (debounced ~2s after last change):**
1. Extracts wikilinks, updates `backlinks.json`
2. Calls `qmd update` (BM25 refresh)
3. Compares page content against existing summary
4. Produces an interpreted change summary (not a raw diff)
5. Optionally suggests tag updates against `taxonomy.md`
6. Appends to `queue.json`
7. If change is significant, schedules `qmd embed` for background vector refresh

**Change summary format:**
```json
{
  "id": "chg-001",
  "timestamp": "2026-03-12T14:23:00Z",
  "page": "road-network.md",
  "tags": ["interface", "constraint"],
  "summary": "Settlement density field now drives road spacing directly. This affects assumptions in arterial-roads.md and may conflict with plot subdivision constraints in blocks.md.",
  "affected_pages": ["arterial-roads.md", "blocks.md"],
  "raw_diff": "..."
}
```

**Does not:** Plan, execute, write wiki pages, or trigger the planning agent directly.

### 5.2 Changes Feed

A panel in the UI showing Haiku's interpreted change summaries, most recent first. Each entry shows:
- The interpreted summary
- Tags
- Affected pages (as hoverable links)
- Raw diff (expandable)
- A checkbox for selection

The user selects one or more change summaries and hits "Plan this". This triggers the planning agent.

### 5.3 Planning Agent

**Role:** Spun up on demand, exits after producing a plan.

**Receives:**
- Selected change summaries from queue
- Full wiki (all pages)
- `backlinks.json`
- `taxonomy.md`
- qmd search results for each change summary (top-k relevant pages)
- Per-page summaries for efficient two-tier retrieval

**Produces:**
- A human-readable plan entry appended to `inbox.md`
- A full structured plan object in `/.meta/plans/`

**Plan entry in inbox.md:**
```markdown
## Plan 2026-03-12-001 — Road network density refactor
*Status: pending*

Settlement density now drives road spacing. Proposed changes:
- Update `arterial-roads.ts` — recalculate spacing from density field
- Update `blocks.md` — note revised subdivision constraint
- Add regression test for water boundary dead-end case

[Full plan details](.meta/plans/plan-2026-03-12-001.json)
```

User edits `Status: pending` to `Status: approved` or `Status: rejected`. The watcher picks this up (it's a user edit) and hands approved plans to the execution agent.

### 5.4 Execution Agent

**Role:** Runs approved plans in the background.

**Receives:** Full plan JSON.

**Writes to:** Codebase and wiki pages (with `last-modified-by: agent`).

**On completion:** Updates plan status in `inbox.md` to `done`, logs actions to the relevant `.meta/pages/*.json` files.

### 5.5 Loop Prevention

Three overlapping guards:

1. **Frontmatter origin tag** — `last-modified-by: agent` suppresses watcher trigger
2. **Write lock** — `agent-writing.lock` exists during any agent write operation
3. **Directory separation** — watcher only monitors `/wiki/pages/`; agents write summaries, plans, and logs to `/.meta/`

---

## 6. Chat-in-Page Interaction

### 6.1 Request/Response Loop

```
user types in text box
  → POST /chat/:page
    → agent receives:
        - current page content
        - chat history from .meta/pages/<page>.json (windowed last-N)
        - qmd search results for the message
        - full wiki (all pages + backlinks.json)
    → agent writes updated page to disk (last-modified-by: agent)
    → agent appends exchange to .meta/pages/<page>.json
  → file watcher sees page changed
    → SSE push to browser
      → page re-renders
      → chat box clears
```

### 6.2 Chat History

Stored in `/.meta/pages/<page-name>.json`:

```json
{
  "page": "road-network.md",
  "history": [
    {
      "timestamp": "2026-03-12T14:00:00Z",
      "role": "user",
      "message": "The frontier expansion needs to respect water boundaries"
    },
    {
      "timestamp": "2026-03-12T14:00:03Z",
      "role": "agent",
      "message": "Updated the constraints section...",
      "page_diff": "..."
    }
  ]
}
```

History is windowed (last N exchanges) before being sent to the agent. Periodic Haiku summarisation pass compresses older history.

---

## 7. Taxonomy System

### 7.1 Categories

Structural — each page belongs to exactly one category. Categories reflect the shape of the system.

Default set (customisable per project):
- `architecture`
- `pipeline`
- `data-model`
- `rendering`
- `testing`
- `observability`
- `decisions`
- `meta`

### 7.2 Tags

Cross-cutting — pages can have many. Tags capture concerns that span categories.

Tags are maintained in `taxonomy.md` as the canonical vocabulary. Haiku suggests new tags and flags convergence between similar tags (e.g. `#road-network` and `#arterial-roads`).

### 7.3 Smart Tagging

When Haiku generates a change summary it:
1. Reads `taxonomy.md`
2. Suggests tags for the changed page from the existing vocabulary
3. Flags if a new tag concept seems warranted (for human confirmation)
4. Detects near-duplicate tags and suggests consolidation

Tag changes to `taxonomy.md` are themselves wiki changes that propagate through the normal pipeline.

---

## 8. Add Page Flow

A prominent "Add Page" button opens a modal with a textarea and submit button. Optional fields: category selector, related pages (seeds context for the agent).

On submit:
1. Agent reads user notes + any related page summaries
2. Infers filename, title, category, initial tags
3. Writes a structured page with proper frontmatter
4. Preserves user's raw notes verbatim under a `## Notes` section
5. Haiku picks up the new file, generates summary, updates backlinks and qmd index

The Notes section is permanent provenance — the original thought before agent shaping.

---

## 9. Search

qmd provides three search modes:

| Mode | Command | Use |
|------|---------|-----|
| BM25 keyword | `qmd search "query" --json` | Known terms, fast |
| Semantic vector | `qmd vsearch "query" --json` | Conceptual queries |
| Hybrid + reranking | `qmd query "query" --json` | Highest quality, slower |

For interactive use (chat, changes feed) the system uses `qmd search` and `qmd vsearch`. The hybrid mode is available for bootstrapping passes where latency is acceptable.

The watcher calls `qmd update` on every page change (BM25 refresh). Vector embeddings are refreshed in the background on a schedule or after significant changes.

Two-tier retrieval for planning agent:
1. `qmd search` → candidate pages
2. Read summaries from frontmatter → narrow to relevant subset
3. Read full page content → only what the plan needs

---

## 10. Git Integration

### 10.1 Reference Validation

A post-commit hook scans all wiki pages for `[[src:...]]` references and:
- Verifies function references still resolve
- Auto-updates line number references where the function moved but still exists
- Flags deleted or renamed functions for human resolution
- Haiku suggests updated references for ambiguous cases

### 10.2 Freshness Metadata

References carry timestamps or commit SHAs. The hook flags pages where referenced files have changed substantially since the reference was made — not broken, but worth reviewing.

---

## 11. Bootstrapping (Claude Code Plugin)

A Claude Code plugin that derives an initial wiki from an existing codebase.

### 11.1 Sources Harvested

| Source | Relationship to truth |
|--------|----------------------|
| Code structure | Ground truth — what system does |
| Tests | What system is supposed to do |
| Existing docs/READMEs | Stated intent, may be stale |
| Inline comments/TODOs | Mixed freshness |
| Git log + diffs | How thinking evolved |
| PR descriptions | Decision rationale, point-in-time |
| Commit messages | Compressed change history |

### 11.2 Passes

**Pass 1 — Structural:** Read codebase, derive component map, create stub pages with categories and tags. Fast, produces skeleton.

**Pass 2 — Semantic:** For each stub, read relevant code in depth, write page content. Uses qmd on harvested docs to pull in related material.

**Pass 3 — Historical:** Walk git log for each page's contributing files. Reconstruct evolution narrative. Add "How thinking evolved" section with inline `[[ref:git:...]]` and `[[ref:pr:...]]` citations.

**Pass 4 — Contradiction detection:** Cross-reference pages. Flag where docs and code disagree or two pages make conflicting claims. Present contradictions explicitly for human resolution rather than silently resolving them.

### 11.3 Page Structure (Bootstrapped)

```markdown
---
[frontmatter with provenance metadata]
---

## Current approach
[derived from code + recent commits]

## How thinking evolved
[chronological narrative with inline ref citations]

## Open questions
[derived from TODOs, unresolved PR comments, skipped tests]

## References
- [1] road-network.ts#buildFrontier — current implementation
- [2] commit abc123f — "replace sequential pipeline with frontier expansion"
- [3] PR #47 — performance issues with large city grids

## Notes
[raw harvested fragments, preserved verbatim]
```

### 11.4 Freshness Resolution

The agent treats sources as a timeline, not a flat set. It reads forwards through git history on each concept — early sources establish original intent, later sources show divergence or evolution. When sources conflict, the most recent authoritative source (code > recent commits > PRs > old docs) wins, but the conflict is noted.

### 11.5 Configurable Judgement Calls

The skill exposes configuration before the run:
- Granularity (per-file vs per-concern vs per-subsystem)
- Freshness weighting (how to rank conflicting sources)
- Contradiction handling (flag vs resolve vs both)
- Which git history depth to traverse

---

## 12. Desktop Extension (.mcpb)

The wiki system is packaged as a Claude Desktop Extension providing:

**MCP tools exposed to Claude:**
- `wiki_search(query, mode)` — BM25 or semantic search
- `wiki_get(page)` — retrieve full page content
- `wiki_edit(page, content)` — write page (sets `last-modified-by: agent`)
- `wiki_list()` — list all pages with summaries
- `wiki_get_changes_feed()` — retrieve pending change summaries
- `wiki_get_inbox()` — retrieve pending plans
- `wiki_approve_plan(plan_id)` — approve a plan for execution

**Local processes managed by the extension:**
- Wiki web server (renderer + chat API)
- File watcher + Haiku reactor
- qmd index (BM25 + embeddings)
- Git hooks installation

---

## 13. Open Questions

### Architecture

> **OQ-1:** Should the planning agent have write access to wiki pages directly, or only to the codebase and `inbox.md`? Giving it wiki write access creates richer feedback loops but increases the risk of the wiki diverging from human intent.

> **OQ-2:** What is the right window size for chat history sent to the agent? Too small loses context; too large is expensive. Should this be configurable per page or global?

> **OQ-3:** Should the execution agent run fully autonomously once approved, or should it checkpoint with the user for multi-step plans? A single approve-then-run model is simpler but risky for large plans.

### Haiku Trigger Logic

> **OQ-4:** What is the right threshold for Haiku to mark a change as "significant enough to warrant a planning agent pass"? Time-based (idle 30s), volume-based (N pages changed), or semantic (does the diff cross a component boundary)? Semantic is more useful but more expensive.

> **OQ-5:** Should Haiku ever proactively suggest tag changes, or only flag them for human confirmation? Proactive changes are convenient but could introduce drift in the taxonomy.

### Search and Retrieval

> **OQ-6:** For the planning agent's full wiki context — is it better to send all page summaries upfront and let the agent request full pages as needed (more round-trips, less token waste), or send everything and rely on the agent's attention (simpler, potentially very large context)?

> **OQ-7:** How often should vector embeddings be refreshed? Per-change is ideal but `qmd embed` can be slow. Nightly refresh may miss important semantic changes.

### UI / Chat-in-Page

> **OQ-8:** Should the chat box support multi-turn within a single session (maintaining a visible exchange before the page is written), or is single-turn (message → page edit → done) enough? Multi-turn is more natural but complicates the re-render model.

> **OQ-9:** Where does the chat input live on the page? Fixed to the bottom of the viewport, or anchored to the bottom of the page content? Fixed feels like a global chat; anchored feels more like page editing.

### Bootstrapping

> **OQ-10:** For projects with very large git histories, the historical pass (Pass 3) could be extremely slow or expensive. Should there be a depth limit, or a "summarise history older than N months" option?

> **OQ-11:** How should the bootstrapper handle monorepos or projects where the relevant code is spread across multiple repositories?

### Deployment and Packaging

> **OQ-12:** The system requires several local processes (wiki server, file watcher, qmd). Should these be managed as a single daemon (simpler UX) or as separate processes the user can control independently (more transparent)?

> **OQ-13:** The Desktop Extension (.mcpb) format is the right packaging target for Claude Desktop, but the wiki system itself is useful independently. Should it also support a standalone CLI mode, or is the Claude integration always required?

> **OQ-14:** How is the qmd index handled across machines / team members sharing the same git repo? The index is derived, so it can be regenerated, but this should be documented clearly.

---

*End of spec v0.1*
