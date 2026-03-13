---
title: Batch Import Pipeline
category: pipeline
tags: [batch-import, pipeline, automation, map-reduce]
summary: "An 8-step pipeline that discovers markdown files in a repository, extracts and groups topics using Haiku subagents, synthesises wiki pages using Sonnet subagents, and stages them for review before applying to the wiki."
last-modified-by: agent
---

## Overview

The batch import pipeline converts existing repository documentation into structured wiki pages. It is invoked via the [[skills|`/octowiki:batch-import` skill]] and implements a map-reduce approach: cheap parallel extraction (Haiku) followed by quality synthesis (Sonnet). Nothing touches the live wiki until the user explicitly approves — all intermediate work is staged in a temporary directory.

**Input:** a repository path containing markdown files
**Output:** new and updated wiki pages written to `wiki/pages/`

**Trigger:** user invokes `/octowiki:batch-import <repo-path> [--dry-run] [--force]`

| Flag | Effect |
|------|--------|
| `<repo-path>` | Path to source repository (defaults to cwd) |
| `--dry-run` | Stop after preview; do not apply to wiki |
| `--force` | Continue even when more than 200 files are discovered |

## Pipeline Steps

### Step 1 — Discover

A Bun script (`src/batch-import/discover.ts`) scans the source repository for all markdown files and writes a manifest to `/tmp/octowiki-import-XXXX/manifest.json`. The manifest includes each file's path, git-derived modification date, and content.

If the manifest contains more than 200 files and `--force` was not passed, the pipeline pauses and requests user confirmation before continuing.

### Step 2 — Index

The wiki's search index is refreshed so that subsequent agents can check for existing coverage:

```bash
qmd update --collection wiki/.index/qmd
qmd embed --collection wiki/.index/qmd
```

This step is skipped if `qmd` is not available.

### Step 3 — Map (Extraction)

Haiku subagents process each file in parallel, in batches of 10. Each subagent:

- Reads the full [[category-taxonomy]]
- Lists existing wiki pages
- Searches for existing coverage of the file's topics
- Extracts wiki-worthy topics with: suggested slug, category, summary, structured content, tags, and a confidence score
- Flags overlaps with existing pages

Results are written as JSON to `/tmp/.../map/<filename>.json`.

### Step 4 — Group

A deterministic grouping function reads all map outputs and clusters related topics by slug. It resolves category conflicts, filters out low-confidence extracts, and determines whether each group should create a new page or merge into an existing one. The result is written to `/tmp/.../groups.json`.

### Step 5 — Reduce (Synthesis)

Sonnet subagents synthesise a complete, well-structured wiki page for each group. Two prompt variants handle different cases:

- **New page:** Structures extracted content into a coherent standalone document with proper headings, cross-references, and sufficient detail for a reader unfamiliar with the source material.
- **Merge:** Incorporates new information into an existing page while preserving its structure and avoiding duplication.

Results are written as JSON to `/tmp/.../reduce/<slug>.json`.

### Step 6 — Create

Pages are staged in `/tmp/.../wiki/pages/`:

- New pages are written using [[skills|add-page skill]] logic with `last-modified-by: agent` in their frontmatter.
- Merges update existing page content and generate diff files under `/tmp/.../merges/` for review.
- Slug collisions are resolved by appending a counter (e.g. `auth-2`).

### Step 7 — Preview

The pipeline outputs a summary of what will be applied:

```
Batch import complete. Staged in /tmp/octowiki-import-a1b2c3/

  New pages (7):
    architecture/api-rate-limiting
    pipeline/data-ingestion
    ...

  Merged into existing (2):
    authentication — added OAuth2 refresh flow
    deployment — added Docker setup

  Skipped (3):
    CHANGELOG.md — not wiki-worthy
    LICENSE.md — not wiki-worthy

  Preview: /tmp/octowiki-import-a1b2c3/wiki/pages/

Apply to wiki? (y/n)
```

With `--dry-run`, the pipeline stops here and the temp directory persists for manual inspection.

### Step 8 — Apply

On user confirmation:

1. `wiki/pages/` is backed up to `wiki/pages-pre-import/`
2. A fresh `wiki/pages/` is created
3. All existing pages are copied in, then new and merged pages overwrite them
4. The search index is refreshed

The import can be fully reverted by restoring the backup directory, or committed by removing it.

## Staging Directory Structure

```
/tmp/octowiki-import-XXXX/
├── manifest.json       # Discovered files and metadata
├── map/                # Per-file extraction outputs
│   ├── file1.md.json
│   └── ...
├── groups.json         # Grouped topics
├── reduce/             # Per-group synthesis outputs
│   ├── slug1.json
│   └── ...
├── merges/             # Diffs for pages being updated
│   └── existing-page.diff
└── wiki/pages/         # Staged pages ready to apply
    ├── category1/
    └── category2/
```

Intermediate outputs persist across runs, enabling inspection and selective re-runs without re-discovering files from scratch.

## Error Handling

- **Subagent failures:** Each map and reduce subagent is retried up to 3 times on timeout or malformed response. Permanent failures are recorded in the skipped list and the pipeline continues without interruption.
- **JSON parsing failures:** Markdown code fences are stripped from subagent responses before retrying the parse.
- **Resumability:** Because all intermediate outputs are written to `/tmp/`, a failed run can be debugged and re-triggered from any phase without starting over.

## Dependencies

- [[skills]] — add-page skill logic is used in the Create step
- [[category-taxonomy]] — provided in full to every map subagent for topic classification
- `qmd` — optional; used for search index management in steps 2 and 8
