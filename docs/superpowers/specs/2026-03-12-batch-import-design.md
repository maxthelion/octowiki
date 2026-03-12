# Batch Import Design

## Goal

A Claude Code skill (`/octowiki:batch-import`) that consolidates documentation from an existing repo into structured wiki pages, using a map-reduce architecture with cheap models for extraction and capable models for synthesis.

## Architecture

Single skill with a hybrid approach: a Bun discovery script handles deterministic file scanning, then the skill coordinator orchestrates LLM-powered map, group, reduce, and create phases via subagents.

**Tech:** Bun script (discovery), Haiku 4.5 (map), Sonnet 4.6 (reduce), qmd (duplicate detection + cross-referencing), add-page skill (page creation).

## Flow

```
/octowiki:batch-import <repo-path> [--dry-run]

1. DISCOVER  — bun run src/batch-import/discover.ts <repo-path>
2. INDEX     — qmd update + qmd embed (ensure wiki index is current)
3. MAP       — Haiku subagents per file (parallel, batches of ~10)
4. GROUP     — deterministic code merges map outputs by topic
5. REDUCE    — Sonnet subagents per group (new pages + merges)
6. CREATE    — add-page skill logic writes to temp dir
7. PREVIEW   — show summary, await confirmation (or stop if --dry-run)
8. APPLY     — copy to wiki/pages/, refresh qmd index
```

Everything is staged in `/tmp/octowiki-import-XXXX/` — nothing touches the real wiki until the apply step.

## Phase 1: Discover

`src/batch-import/discover.ts` — pure Bun, no LLM calls.

**Input:** repo path (defaults to cwd)

**Process:**
1. Find all `.md` files, excluding `node_modules`, `.git`, `dist`, `wiki/`, `.meta/`, `.index/`
2. Skip files larger than 100KB (log a warning)
3. Get last modified date per file via `git log -1 --format=%aI -- <file>` (fall back to filesystem mtime if git returns nothing — e.g. untracked files or non-git repos)
4. Read file content
5. Create temp dir `/tmp/octowiki-import-XXXX/`
6. Write `manifest.json`
7. If more than 200 files found, warn and require `--force` to proceed

**Output — `manifest.json`:**
```json
{
  "repoPath": "/path/to/repo",
  "createdAt": "2026-03-12T...",
  "tmpDir": "/tmp/octowiki-import-a1b2c3",
  "files": [
    {
      "path": "docs/auth.md",
      "relativePath": "docs/auth.md",
      "lastModified": "2026-02-15T10:30:00Z",
      "sizeBytes": 2340,
      "content": "# Authentication\n..."
    }
  ]
}
```

Callable standalone for debugging: `bun run src/batch-import/discover.ts /path/to/repo`

## Phase 2: Index

Before dispatching map agents, the coordinator ensures the wiki's qmd index is current:
1. `qmd update` — refresh BM25 index
2. `qmd embed` — refresh vector embeddings

This allows map agents to check for existing coverage.

## Phase 3: Map

One Haiku subagent per input file, dispatched in parallel (batches of ~10).

**Subagent receives:**
- File content, path, and git date
- Category taxonomy (from `wiki/pages/category-taxonomy.md`)
- List of existing wiki page slugs
- qmd search results for the file's title/key terms

**Subagent returns:**
```json
{
  "file": "docs/auth.md",
  "topics": [
    {
      "topic": "authentication",
      "suggestedSlug": "authentication",
      "category": "architecture",
      "summary": "OAuth2 flow with JWT refresh tokens",
      "content": "extracted and lightly restructured content...",
      "tags": ["auth", "oauth2", "jwt"],
      "confidence": 0.9
    }
  ],
  "existingOverlaps": [
    {
      "topic": "authentication",
      "existingSlug": "authentication",
      "overlapLevel": "high",
      "recommendation": "merge_into_existing"
    }
  ],
  "skipped": "Changelog section — not wiki-worthy"
}
```

Key behaviours:
- A single file can produce multiple topics
- Haiku assesses wiki-worthiness — skips changelogs, license blocks, badges, boilerplate
- Category is assigned against the real taxonomy, not invented
- qmd results inform overlap detection with existing wiki pages
- `confidence` score helps the group phase filter low-quality extracts

Results written to `/tmp/.../map/<filename>.json`.

## Phase 4: Group

Pure code, no LLM. Coordinator reads all map outputs and groups them.

**Process:**
1. Collect all topics from all map outputs
2. Group by `suggestedSlug` — same slug from different files = merged group
3. When a group has conflicting categories, use the category from the highest-confidence extract
4. For topics flagged `merge_into_existing`, attach the existing page content
5. Within each group, sort extracts by `lastModified` (most recent first)
6. Drop extracts with `confidence` below threshold (0.3)
7. Collect all tags from grouped extracts into the group (the Reduce agent selects the final 2-5)

**Output — `/tmp/.../groups.json`:**
```json
{
  "newPages": [
    {
      "slug": "api-rate-limiting",
      "category": "architecture",
      "extracts": [
        {"source": "docs/api.md", "date": "2026-02-15", "content": "..."},
        {"source": "README.md", "date": "2025-11-03", "content": "..."}
      ]
    }
  ],
  "mergeIntoExisting": [
    {
      "slug": "authentication",
      "existingContent": "current wiki page content...",
      "extracts": [
        {"source": "docs/auth.md", "date": "2026-03-01", "content": "..."}
      ]
    }
  ],
  "skipped": [
    {"source": "CHANGELOG.md", "reason": "Not wiki-worthy"}
  ]
}
```

This file is what `--dry-run` shows the user for review.

## Phase 5: Reduce

Sonnet subagents, one per group. Two prompt variants.

### New page reduce

**Receives:** grouped extracts (recency-ordered), category taxonomy, content guidelines, qmd results for related pages.

**Returns:**
```json
{
  "slug": "api-rate-limiting",
  "title": "API Rate Limiting",
  "category": "architecture",
  "tags": ["api", "rate-limiting", "throttling"],
  "summary": "Per-endpoint sliding window rate limits...",
  "content": "## Overview\n\nThe API uses sliding window rate limiting...\n\nSee [[authentication]] for how rate limits interact with auth tokens.\n..."
}
```

### Merge reduce

**Receives:** existing wiki page content (including frontmatter), new extracts to incorporate, content guidelines.

**Returns:**
```json
{
  "slug": "authentication",
  "action": "update",
  "title": "Authentication",
  "category": "architecture",
  "tags": ["auth", "oauth2", "jwt"],
  "summary": "Updated summary reflecting new content...",
  "content": "updated markdown with new information woven in...",
  "changelog": "Added OAuth2 refresh token flow from docs/auth.md"
}
```

All frontmatter fields are returned so they can be updated if the merge warrants it (e.g. new tags, refined summary).

### Constraints in reduce prompts:
- Follow content guidelines — one description per concept, link elsewhere
- Prefer content from more recent sources when conflicting
- Use `[[wikilinks]]` to cross-reference, don't repeat
- Set `last-modified-by: agent` for all batch-created/modified pages (the add-page skill defaults to `user`, so the coordinator patches this after page creation)

Results written to `/tmp/.../reduce/<slug>.json`.

## Phase 6: Create

- **New pages** — coordinator calls add-page skill logic, writing to `/tmp/.../wiki/pages/`. Slug collisions (between staged pages or against existing wiki) are resolved using the add-page skill's append-a-number rule.
- **Merges** — coordinator writes updated content to `/tmp/.../wiki/pages/` and generates `/tmp/.../merges/<slug>.diff` showing changes vs existing
- After writing, coordinator patches `last-modified-by: agent` in frontmatter (overriding add-page's default of `user`)

## Phase 7: Preview

Coordinator outputs summary:
```
Batch import complete. Staged in /tmp/octowiki-import-a1b2c3/

  New pages (7):
    architecture/api-rate-limiting
    architecture/database-schema
    pipeline/data-ingestion
    ...

  Merged into existing (2):
    authentication — added OAuth2 refresh flow
    deployment — added Docker setup from ops/README.md

  Skipped (3):
    CHANGELOG.md — not wiki-worthy
    LICENSE.md — not wiki-worthy
    docs/old-design.md — superseded by existing design-spec

  Preview: /tmp/octowiki-import-a1b2c3/wiki/pages/

Apply to wiki? (y/n)
```

If `--dry-run`: stop here. Temp dir persists for browsing.

## Phase 8: Apply

1. Copy new pages from temp dir to `wiki/pages/`
2. Write merged pages over existing ones
3. Run `qmd update` + `qmd embed` to refresh index
4. Report final count

## Scope

**In scope (v1):** `.md` files only — documentation consolidation.

**Future:** Source file analysis (`.ts`, `.tsx`, etc.) to extract architecture knowledge, cross-reference docs against what's actually built, detect stale documentation.

## Key Design Decisions

- **Wiki-first** — the skill follows the wiki-first workflow: understand existing wiki state (via qmd) before creating anything
- **Recency bias** — when sources conflict, prefer the most recently modified
- **Single page creation path** — all pages go through add-page skill logic, even in batch
- **Temp staging** — nothing touches the real wiki until explicit apply, making the process safe and previewable
- **Model allocation** — Haiku for mechanical extraction (map), Sonnet for synthesis requiring judgment (reduce)
- **qmd integration** — search existing wiki before map phase to detect duplicates and find cross-reference targets

## Error Handling

- **LLM call failures** — subagents that fail (timeout, malformed response) are retried up to 3 times. On permanent failure, the file/group is added to `skipped` with the error reason and the batch continues.
- **Partial failures** — the batch is designed to be resumable. The manifest and intermediate outputs in `/tmp/` persist, so a failed run can be debugged and re-triggered.

## Skill Registration

The skill lives at `.claude/skills/octowiki-batch-import/SKILL.md` following the same pattern as the add-page skill. It instructs the coordinator to run the discovery script first, then orchestrate the phases described above.
