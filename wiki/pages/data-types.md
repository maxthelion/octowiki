---
title: Core Data Types
category: data-model
tags: [types, typescript, schema, data-model]
summary: "Canonical TypeScript interfaces for the core domain objects used throughout OctoWiki, defined in src/types.ts."
last-modified-by: agent
---

## Overview

OctoWiki's core domain objects are defined as TypeScript interfaces in `src/types.ts`. These types are shared across the system — from the storage layer to the rendering pipeline to agent interactions — ensuring consistency and type safety throughout.

Five primary types make up the data model: `WikiPage`, `ChangeSummary`, `Plan`, `PlanStep`, and `ChatExchange`.

## WikiPage

`WikiPage` is the central type. Every page stored in the wiki is an instance of this interface.

```typescript
interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  lastModifiedBy: "user" | "agent";
  content: string; // full markdown (excluding frontmatter)
}
```

### Field descriptions

| Field | Type | Description |
|---|---|---|
| `slug` | `string` | URL-safe unique identifier for the page (e.g. `data-types`) |
| `title` | `string` | Human-readable display title |
| `category` | `string` | One of the canonical categories defined in [[category-taxonomy]] |
| `tags` | `string[]` | Keywords for search and related-page discovery |
| `summary` | `string` | One-sentence description of the page's content |
| `lastModifiedBy` | `"user" \| "agent"` | Tracks whether the last edit came from a human or an automated agent |
| `content` | `string` | Full markdown body, excluding frontmatter |

The `content` field contains only the body of the page. Frontmatter (slug, title, category, tags, summary, lastModifiedBy) is stored separately and serialised into the file header on disk.

## ChangeSummary

`ChangeSummary` records a discrete change to a wiki page. It is used by the activity and history subsystems.

```typescript
interface ChangeSummary {
  id: string;                  // unique identifier
  timestamp: string;           // ISO 8601
  page: string;               // page slug
  tags: string[];             // suggested by Haiku
  summary: string;            // one-sentence change description
  affectedPages: string[];    // related pages
  rawDiff: string;            // git diff or similar
}
```

### Field descriptions

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for this change event |
| `timestamp` | `string` | ISO 8601 datetime of when the change occurred |
| `page` | `string` | Slug of the page that was changed |
| `tags` | `string[]` | Tags suggested by Haiku to categorise the change |
| `summary` | `string` | One-sentence description of what changed and why |
| `affectedPages` | `string[]` | Slugs of other pages related to or affected by this change |
| `rawDiff` | `string` | The raw diff (e.g. git diff output) representing the change |

## Plan and PlanStep

`Plan` represents a multi-step agent plan — a proposed set of changes to the wiki that can be reviewed and approved before execution.

```typescript
interface Plan {
  id: string;                 // plan-YYYY-MM-DD-NNN
  title: string;
  status: "pending" | "approved" | "rejected" | "done" | "failed";
  summary: string;
  steps: PlanStep[];
  error?: string;             // if status == failed
}

interface PlanStep {
  description: string;
  target: string;             // file path or page slug
  action: "create" | "update" | "delete";
}
```

### Plan field descriptions

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Identifier in the format `plan-YYYY-MM-DD-NNN` |
| `title` | `string` | Human-readable name for the plan |
| `status` | `string` | Lifecycle state — see status values below |
| `summary` | `string` | One-sentence description of the plan's intent |
| `steps` | `PlanStep[]` | Ordered list of actions to be performed |
| `error` | `string?` | Present only when `status` is `"failed"`; describes what went wrong |

### Plan status values

| Status | Meaning |
|---|---|
| `pending` | Created but not yet reviewed |
| `approved` | Approved by the user, ready for execution |
| `rejected` | Rejected by the user; will not be executed |
| `done` | Successfully executed |
| `failed` | Execution attempted but encountered an error |

### PlanStep field descriptions

| Field | Type | Description |
|---|---|---|
| `description` | `string` | Human-readable explanation of what this step does |
| `target` | `string` | The file path or page slug this step acts on |
| `action` | `string` | One of `"create"`, `"update"`, or `"delete"` |

## ChatExchange

`ChatExchange` represents a single turn in a conversation between the user and an agent, optionally including a page diff produced by agent actions.

```typescript
interface ChatExchange {
  timestamp: string;
  role: "user" | "agent";
  message: string;
  pageDiff?: string;          // if role == agent
}
```

### Field descriptions

| Field | Type | Description |
|---|---|---|
| `timestamp` | `string` | ISO 8601 datetime of the exchange |
| `role` | `"user" \| "agent"` | Who sent this message |
| `message` | `string` | The text content of the exchange |
| `pageDiff` | `string?` | Present only on agent turns; shows what page content changed as a result |

## Relationships Between Types

- A `WikiPage` is the primary entity. `ChangeSummary` records reference pages by slug (`page` field), as do `PlanStep` targets.
- A `Plan` is composed of one or more `PlanStep` objects. Plans are proposed by agents and acted on by users.
- `ChatExchange` is ancillary to the page model — it captures the conversational context around edits, with `pageDiff` linking agent turns back to specific page changes.

## Serialisation

On disk, `WikiPage` data is stored as a markdown file with a YAML frontmatter block containing the metadata fields (slug, title, category, tags, summary, lastModifiedBy) followed by the `content` field as the file body. See [[category-taxonomy]] for how the `category` field is constrained.
