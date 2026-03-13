---
title: Planning and Execution Workflow
category: pipeline
tags: [workflow, planning, execution, git, agents]
summary: Describes how wiki changes move from detection in the Feed through AI-assisted planning to automated execution on isolated git branches.
last-modified-by: agent
---

## Overview

Octowiki uses a two-agent pipeline to manage wiki changes safely: a **planning agent** that analyses pending changes and produces a structured plan, and an **execution agent** that carries out the plan on an isolated git branch. The user reviews and approves at each stage before anything is written.

## Pipeline Steps

### 1. Detect Changes (Feed)

The **Feed** panel displays recent modifications to wiki pages. This is the entry point — it surfaces the raw inputs that may require further wiki work.

### 2. Trigger Planning

The user selects one or more changes from the Feed and clicks **"Plan this"**. This triggers the planning agent, which analyses the selected changes and produces a plan describing:

- What will be changed
- Why the changes are being made
- Dependencies between changes

#### Planning Agent Context Strategy

The planning agent uses a two-tier context retrieval strategy to balance richness with token efficiency:

**Tier 1 — loaded upfront:**
- All page summaries (from frontmatter)
- `backlinks.json` (page relationship map)
- `category-taxonomy.md` — see [[category-taxonomy]]
- Semantic search results for each change summary

**Tier 2 — fetched on demand:**
- The agent requests full page content for specific pages as needed
- The server returns the full page markdown
- Only pages the agent actually references are fetched, minimising token usage

This scales well as the wiki grows: summaries are lightweight, and the agent can reason about relationships before deciding what to read in full.

### 3. Review Plans (Inbox)

Created plans appear in the **Inbox** panel. The user reviews each plan before approving.

### 4. Approve Execution

When satisfied with a plan, the user approves it. Approval moves the plan from `pending` to `approved` status and triggers the execution agent.

### 5. Automated Execution

The execution agent runs on the approved plan using a safe branching model:

**Branch lifecycle:**

| Stage | Detail |
|-------|--------|
| Naming | `octowiki/plan-YYYY-MM-DD-NNN` |
| Creation | When plan moves from `pending` → `approved` |
| Work | Agent commits incrementally as it executes plan steps |
| On success | Plan status set to `done`; branch remains for review |
| On failure | Plan status set to `failed`; partial work preserved on branch |
| Cleanup | Manual — user decides when to merge or delete |

**Safety guarantees:**
- The main branch is never directly modified by the execution agent
- All changes are visible before merging
- If a plan fails partway, the partial work is preserved on the branch for inspection
- The branch persists, allowing the user to continue or restart

Plan status is updated in `inbox.md` after completion. Failures include an error summary for debugging.

### 6. Merge

The user reviews the git branch and merges using standard git workflows when ready.

## Error Handling

- On failure, the execution agent sets plan status to `failed` and records an error summary in `inbox.md`
- The partial branch is preserved so the user can inspect what was completed before the failure
- No automatic retry — the user decides whether to re-approve or abandon the plan

## Dependencies

- [[skills]] — the add-page skill and batch-import skill are separate entry points that can produce wiki changes picked up by the Feed
- [[category-taxonomy]] — consulted by the planning agent when classifying or restructuring pages
- [[bootstrapping]] — the initial population of the wiki is a related but distinct process; this pipeline handles ongoing changes after bootstrapping
