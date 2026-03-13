---
title: Open Questions Resolution (OQ-1 through OQ-14)
category: decisions
tags: [architecture, decisions, agents, planning]
summary: "Records the 14 concrete architectural decisions made during the OctoWiki design phase, covering agent autonomy, context retrieval, storage, process model, and distribution strategy."
last-modified-by: agent
---

## Overview

During the initial design phase (2026-03-12), 14 open architectural questions (OQ-1 through OQ-14) were identified and resolved. These decisions establish hard constraints for the v1 implementation across agent behaviour, UI layout, storage strategy, and distribution. Each decision was made with the context of shipping a focused, maintainable first version rather than an open-ended platform.

## OQ-1: Planning Agent Wiki Write Access

**Decision:** The planning agent may only write to the codebase and `inbox.md`.

**Context:** Giving the planning agent unrestricted wiki write access risks uncontrolled mutations to canonical pages during plan drafting, making it difficult to audit or roll back changes.

**Options considered:**
- Full write access to all wiki pages
- Read-only access
- Limited write access (codebase + inbox only)

**Rationale:** Restricting writes to `inbox.md` keeps plan artifacts in a known, reviewable location. The codebase itself is under version control, so those writes are naturally auditable.

**Consequences:** Agents that need to propose wiki changes must do so through the inbox workflow rather than directly editing pages.

## OQ-2: Chat History Window

**Decision:** A fixed global window of the last 10 exchanges is maintained as chat history.

**Context:** Unbounded history growth increases token cost and latency. Per-page history adds implementation complexity with marginal benefit for typical editing sessions.

**Options considered:**
- Unbounded global history
- Per-page history
- Fixed global window

**Rationale:** 10 exchanges covers the depth of most single-session conversations without requiring summarisation infrastructure in v1.

**Consequences:** Long-running sessions that span more than 10 turns will lose older context. This is acceptable for v1; summarisation can be added later.

## OQ-3: Execution Agent Autonomy

**Decision:** The execution agent operates fully autonomously after plan approval.

**Context:** Requiring human confirmation at each execution step would significantly slow down the agent loop and reduce the value of automation.

**Options considered:**
- Step-by-step confirmation
- Fully autonomous post-approval
- Autonomous with interrupt capability

**Rationale:** Once the user has reviewed and approved a plan, the execution agent should be trusted to carry it out without further interruption. The plan approval step is the control point.

**Consequences:** Errors during execution cannot be intercepted mid-flight. The plan must be thorough enough to anticipate failure modes before approval.

## OQ-4: Haiku Trigger Threshold

**Decision:** Haiku (the lightweight summarisation/tagging model) is triggered on a time-based threshold of 30 seconds idle, separate from the 2-second SSE watcher debounce.

**Context:** Triggering Haiku on every keystroke is wasteful. The SSE watcher already debounces at 2 seconds for real-time feedback; a longer idle threshold is appropriate for heavier background processing.

**Options considered:**
- Trigger on every save
- Trigger on SSE debounce (2s)
- Separate longer idle threshold (30s)

**Rationale:** 30 seconds gives the user time to finish a thought before background processing begins, reducing redundant model calls.

**Consequences:** Tags and summaries may lag up to 30 seconds behind the latest edits during active writing sessions.

## OQ-5: Tag Auto-Apply Behaviour

**Decision:** Tag suggestions are applied directly with undo logging rather than requiring explicit user confirmation.

**Context:** Surfacing suggestions without applying them adds friction. Most tag suggestions are correct; the cost of a bad suggestion is low if it can be undone.

**Options considered:**
- Show suggestions, require confirmation
- Apply directly, no undo
- Apply directly with undo logging

**Rationale:** Direct application with undo logging gives the best balance of speed and recoverability. The undo log provides an audit trail without interrupting flow.

**Consequences:** Users may occasionally find unexpected tags applied to pages. The undo log must be surfaced accessibly.

## OQ-6: Planning Agent Context Retrieval

**Decision:** Two-tier retrieval — page summaries are loaded upfront; full page content is fetched on demand.

**Context:** Loading all full wiki pages into the planning agent's context window is impractical at scale. But providing no context leads to poor plan quality.

**Options considered:**
- Load all pages in full
- Load no pages (agent fetches as needed)
- Two-tier: summaries upfront, full pages on demand

**Rationale:** Summaries give the planner enough orientation to identify which full pages it needs, without saturating the context window.

**Consequences:** The quality of summaries directly affects planning quality. Summary generation (see OQ-4) must be reliable.

## OQ-7: Vector Embedding Refresh Strategy

**Decision:** Vector embeddings are refreshed only on significant changes, not on every edit.

**Context:** Re-embedding on every keystroke or save is expensive. Stale embeddings for minor edits (typos, formatting) have negligible impact on retrieval quality.

**Options considered:**
- Refresh on every save
- Refresh on a schedule
- Refresh on significant changes only

**Rationale:** "Significant changes" can be approximated by diff size or semantic distance. This avoids unnecessary API calls while keeping retrieval quality high for substantive edits.

**Consequences:** The definition of "significant" must be operationalised. Minor edits may not be immediately reflected in search results.

## OQ-8: Chat-in-Page Interaction Model

**Decision:** Single-turn model — one message produces one edit, then the interaction is complete.

**Context:** Multi-turn in-page chat requires maintaining per-page conversation state, which adds significant complexity.

**Options considered:**
- Multi-turn conversational model
- Single-turn model

**Rationale:** Most in-page editing requests are atomic: "rewrite this section", "add a note about X". A single-turn model satisfies these without requiring a conversation loop.

**Consequences:** Complex editing tasks that require iterative refinement must be broken into separate single-turn interactions by the user.

## OQ-9: Chat Input Placement

**Decision:** The chat input is fixed to the bottom of the viewport.

**Context:** Inline chat (positioned near the cursor or selection) requires tracking scroll position and page layout, adding rendering complexity.

**Options considered:**
- Inline, near cursor/selection
- Fixed to bottom of viewport
- Floating panel

**Rationale:** Bottom-fixed input is a familiar pattern (used by most chat UIs) and requires no layout calculation. It is always reachable regardless of scroll position.

**Consequences:** The chat input is visually disconnected from the content being edited. Context about which section the user is editing must be conveyed through the message text or selection state.

## OQ-10: Git History Depth

**Decision:** Git history is retrieved to a depth limit; older history beyond the limit is summarised.

**Context:** Full git history can be extremely large on mature repositories. Passing the entire log to an LLM is impractical.

**Options considered:**
- Full history, no limit
- Fixed depth limit, no older history
- Depth limit plus summarisation for older history

**Rationale:** Summarisation preserves some signal from older history (major refactors, key decisions) without passing raw log data.

**Consequences:** Summary quality determines how much historical context is preserved. The depth limit and summarisation strategy must be tuned.

## OQ-11: Repository Support

**Decision:** v1 supports a single repository only.

**Context:** Multi-repo support requires a more complex data model, cross-repo linking, and disambiguation in search.

**Options considered:**
- Multi-repo from v1
- Single repo for v1, multi-repo later

**Rationale:** The overwhelming majority of initial users will be working with a single codebase. Deferring multi-repo complexity keeps v1 focused and shippable.

**Consequences:** Users with monorepos or multi-repo setups cannot use OctoWiki for their full stack in v1. This is a known limitation.

## OQ-12: Process Model

**Decision:** A single daemon process for the entire application.

**Context:** A multi-process architecture (separate processes for the watcher, agent runner, embedding service, etc.) adds inter-process communication overhead and complicates startup/shutdown.

**Options considered:**
- Multi-process with IPC
- Single daemon process

**Rationale:** A single daemon is simpler to install, run, and debug. Bun's concurrency model (async/await, worker threads if needed) is sufficient for the workloads involved.

**Consequences:** A crash in one subsystem brings down the entire daemon. Fault isolation will need to be addressed in a future version if stability becomes a concern.

## OQ-13: Distribution Strategy

**Decision:** Standalone CLI first; Desktop extension to follow.

**Context:** Building a Desktop extension first ties the release schedule to the Desktop app release cycle and requires additional packaging work.

**Options considered:**
- Desktop extension only
- Standalone CLI only
- CLI first, extension later

**Rationale:** A standalone CLI can be installed with a single `bun install` and is immediately usable in any terminal. It also allows the core to be validated independently of any UI shell.

**Consequences:** The initial UX is terminal-based. Users who prefer a GUI must wait for the Desktop extension.

## OQ-14: QMD Index Sharing

**Decision:** The `.qmd` index is gitignored and regenerated on clone.

**Context:** Committing a large, frequently-changing binary index file causes unnecessary churn in git history and merge conflicts.

**Options considered:**
- Commit the index
- Gitignore and regenerate on clone

**Rationale:** Regeneration is cheap (seconds on a typical codebase) and eliminates an entire class of git conflicts.

**Consequences:** The first run after a clone requires an indexing pass. This must be clearly communicated in the setup documentation.

## Related

- [[bootstrapping]] — the batch import process that populates the wiki
- [[skills]] — agent skills that implement the behaviours described in these decisions
