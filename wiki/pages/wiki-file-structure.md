---
title: Wiki File Structure
category: data-model
tags: [file-structure, frontmatter, metadata, page-format]
summary: "Defines the directory layout, page frontmatter schema, and supporting JSON file formats that make up the wiki's on-disk data model."
last-modified-by: agent
---

## Overview

The wiki stores all content and agent metadata on disk in a structured directory tree. User-editable markdown pages live under `wiki/pages/`. Agent-generated state — chat histories, change queues, backlinks, and write guards — lives under `wiki/.meta/`. Search indexes are stored separately under `wiki/.index/`.

Understanding this layout is essential for working with the file watcher, the change-queue pipeline, and the [[skills]] that read and write pages.

## Directory Layout

```
/wiki
  /pages/                        ← user-editable markdown pages (watched)
    *.md
  /.meta/
    /pages/
      *.json                     ← per-page chat history + agent action log
    /plans/
      plan-YYYY-MM-DD-NNN.json   ← full structured plan objects
    queue.json                   ← Haiku's accumulated change queue
    backlinks.json               ← maintained by watcher
    agent-writing.lock           ← write guard (prevents watcher loops)
  /.index/
    qmd/                         ← qmd collection index (BM25 + embeddings)
```

Pages under `wiki/pages/` are the source of truth for wiki content and are watched for changes. The `.meta/` subtree is agent-managed and should not be edited directly.

## Page Frontmatter

Every markdown file in `wiki/pages/` begins with a YAML frontmatter block:

```yaml
---
title: Road Network Generation
category: pipeline
tags: [road-network, frontier-expansion, performance]
summary: "Describes the priority-queued frontier expansion algorithm for
  arterial road generation."
last-summarised: 2026-03-12T14:23:00
last-modified-by: user
---
```

### Frontmatter Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | String | Yes | Human-readable display name for the page |
| `category` | String | Yes | One of the canonical categories defined in [[category-taxonomy]] |
| `tags` | Array | No | 2–5 cross-cutting tags that aid discovery and organisation |
| `summary` | String | No | One-sentence overview; maintained by Haiku after each summarisation pass |
| `last-summarised` | Timestamp | No | ISO 8601 timestamp of the last summary refresh by the agent |
| `last-modified-by` | String | No | `user` or `agent`; controls whether the file watcher triggers an agent update |

Valid values for `category` are defined in [[category-taxonomy]]. Tags should be chosen from the vocabulary in the taxonomy where possible, using 2–5 tags per page.

## Page Content

Markdown content follows the closing `---` fence. The format supports:

- Standard markdown: headings, lists, code blocks, tables
- `[[wikilinks]]` for cross-referencing other pages by slug (see [[content-guidelines]] for usage rules)
- File naming uses kebab-case slugs that match the page concept

## Chat History Files

Stored at `/.meta/pages/<page-slug>.json`, one file per page. Each file records the conversation between the user and agents in the context of that page:

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

History is windowed to the last N exchanges before being sent to an agent. Haiku periodically compresses older history into a summary to keep context windows manageable.

## Change Queue (`queue.json`)

Stored at `/.meta/queue.json`. When a page changes, Haiku appends an interpreted change summary to this queue so that downstream agents can assess cross-page impact:

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

### Change Queue Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier for the change entry |
| `timestamp` | Timestamp | ISO 8601 time the change was queued |
| `page` | String | Filename of the changed page |
| `tags` | Array | Tags indicating the nature of the change |
| `summary` | String | Haiku's natural-language summary of impact |
| `affected_pages` | Array | Pages that may need updating as a result |
| `raw_diff` | String | The underlying file diff |

## Backlinks Index (`backlinks.json`)

Stored at `/.meta/backlinks.json` and maintained by the file watcher. Maps each page slug to the set of pages that reference it via `[[wikilinks]]`, enabling efficient reverse-link traversal and validation.

## Plan Files

Structured plan objects are stored at `/.meta/plans/plan-YYYY-MM-DD-NNN.json`. These capture agent-generated execution plans — sequences of intended page edits — before they are applied.

## Write Guard (`agent-writing.lock`)

The file `/.meta/agent-writing.lock` is created by an agent before it writes to `wiki/pages/` and removed when the write completes. The file watcher checks for this lock before triggering a new agent update, preventing feedback loops where agent writes re-trigger themselves.

## Related

- [[category-taxonomy]] — canonical category and tag vocabulary used in frontmatter
- [[content-guidelines]] — rules for writing page content and using wikilinks
- [[skills]] — automation tools that read and write this file structure
