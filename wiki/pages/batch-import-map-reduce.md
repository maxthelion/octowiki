---
title: Batch Import Map-Reduce Algorithm
category: algorithms
tags: [batch-import, map-reduce, deduplication, topic-extraction, synthesis]
summary: "The three-phase map-reduce algorithm used by batch import to transform raw documentation files into structured wiki pages via parallel Haiku extraction, deterministic grouping, and Sonnet synthesis."
last-modified-by: agent
---

## Overview

The [[bootstrapping]] batch import process transforms a set of raw markdown documentation files into wiki pages using a three-phase map-reduce strategy. The pattern separates concerns cleanly: the **map phase** extracts structured topics from individual files in parallel, the **group phase** deterministically deduplicates and clusters related topics, and the **reduce phase** synthesises each cluster into a coherent, standalone wiki page.

This approach allows the system to process large documentation sets efficiently while preserving quality — LLM calls are isolated to well-defined extraction and synthesis tasks, and the grouping logic between them is deterministic code with no LLM involvement.

## Phase 1: Map (Topic Extraction)

### Problem it solves

Raw documentation files contain mixed content — some sections are wiki-worthy, others are boilerplate, changelogs, or license blocks. A single file may also cover multiple distinct topics. The map phase identifies and extracts only the valuable content, structured for downstream processing.

### Approach

For each file in the manifest, a Haiku 4.5 subagent is dispatched to read the file and produce structured topic extracts. Subagents run in **parallel batches of 10** to keep throughput high.

**Each subagent receives:**
- File content, path, and git modification date
- The [[category-taxonomy]] (to constrain category assignment)
- The list of existing wiki page slugs
- Search results for the file's title and key terms (to detect existing coverage)

**Each subagent outputs** a JSON structure per file:

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

Results are written to `/tmp/.../map/<filename>.json`.

### Key parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| Batch size | 10 | Controls parallelism vs. resource usage |
| Retry attempts | 3 | Resilience against JSON parse failures |
| Model | Haiku 4.5 | Fast and cost-effective for extraction |

### Key behaviours

- **Multiple topics per file:** A single file can yield multiple topics if it covers distinct concepts
- **Wiki-worthiness assessment:** Haiku skips changelogs, license blocks, badges, and boilerplate
- **Taxonomy validation:** Categories are assigned against the real [[category-taxonomy]], never invented
- **Confidence scoring:** Each topic receives a `confidence` score (0.0–1.0) used by the group phase to filter low-quality extracts

## Phase 2: Group (Deterministic Clustering)

### Problem it solves

Multiple source files may independently document the same topic, producing duplicate extracts with the same suggested slug. Before synthesis, these must be clustered together. Some topics may already have existing wiki pages that should be updated rather than replaced. The group phase resolves both concerns without any LLM involvement.

### Approach

The grouping function (`groupMapOutputs`) runs as deterministic code after all map outputs are collected. Its signature:

```typescript
export function groupMapOutputs(
  mapOutputs: MapOutput[],
  existingPages: Record<string, string>,  // slug -> raw content
  fileDates: Record<string, string>        // file path -> ISO date
): GroupsOutput
```

### Algorithm steps

1. Initialise three output buckets: `newPages`, `mergeIntoExisting`, `skipped`
2. For each topic in each map output:
   - **Filter by recommendation** — if flagged "skip", move to skipped bucket
   - **Filter by confidence** — if confidence < 0.3, move to skipped bucket
   - **Create or fetch bucket** — keyed by `suggestedSlug`; initialise with the topic's category and confidence if new
   - **Set merge flag** — if slug matches an existing page or is flagged "merge_into_existing"
   - **Append extract** — add source, date, content, tags, and confidence to the bucket
   - **Resolve category conflict** — if this topic's confidence exceeds the bucket's best confidence, update the bucket's category
   - **Merge tags** — append any new tags to the bucket's `allTags` list (deduplicated, order of first appearance)
3. Sort each bucket's extracts by date descending (recency bias)
4. Route each bucket to `newPages` or `mergeIntoExisting` based on the merge flag

### Filtering rules

| Condition | Action |
|-----------|--------|
| Confidence < 0.3 | Skip |
| Overlap recommendation = "skip" | Skip |
| Overlap recommendation = "merge_into_existing" or slug exists in `existingPages` | Route to `mergeIntoExisting` |
| Default | Route to `newPages` |

### Output structure

```typescript
interface GroupsOutput {
  newPages: NewPageGroup[];           // New pages to create
  mergeIntoExisting: MergeGroup[];    // Pages to update with new content
  skipped: SkippedFile[];             // Dropped files or extracts
}
```

This output is also what a `--dry-run` exposes for user review before any pages are written.

### Trade-offs

- **Deterministic grouping avoids LLM cost** for a step that is fundamentally a data-merging problem, but means subtle semantic equivalences (same topic, different slugs) are not detected — only exact slug matches cluster together
- **Highest-confidence category wins** on conflict, which is a simple heuristic; a topic with slightly higher confidence in a wrong category could win over a correct lower-confidence one

Implementation lives in `src/batch-import/group.ts`; tests in `src/batch-import/__tests__/group.test.ts`.

## Phase 3: Reduce (Synthesis)

### Problem it solves

Clustered extracts are raw source material — they may overlap, use inconsistent voice, or lack the structure needed for a good wiki page. The reduce phase uses a Sonnet subagent per group to synthesise a polished, standalone document. For merge groups, it must weave new information into an existing page without disrupting its structure.

### Approach

One Sonnet 4.6 subagent is dispatched per group. Two prompt variants handle the two cases:

**New page variant — inputs:**
- Slug, category, and collected tags from the group phase
- Extracts sorted by recency (most recent first)
- [[category-taxonomy]] guidelines for the target category
- [[content-guidelines]]
- Search results for related existing pages

**New page variant — output:**

```json
{
  "slug": "api-rate-limiting",
  "title": "API Rate Limiting",
  "category": "architecture",
  "tags": ["api", "rate-limiting", "throttling"],
  "summary": "Per-endpoint sliding window rate limits...",
  "content": "## Overview\n\n..."
}
```

**Merge variant — inputs:**
- Existing wiki page content (including frontmatter)
- New extracts to incorporate
- [[content-guidelines]]

**Merge variant — output:**

```json
{
  "slug": "authentication",
  "action": "update",
  "title": "Authentication",
  "category": "architecture",
  "tags": ["auth", "oauth2", "jwt"],
  "summary": "Updated summary...",
  "content": "full updated markdown...",
  "changelog": "Added OAuth2 refresh token flow from docs/auth.md"
}
```

Results are written to `/tmp/.../reduce/<slug>.json`.

### Key constraints enforced by all reduce prompts

- **Every group is processed by Sonnet** — there is no auto-pass-through for single-extract groups; synthesis always runs
- **Distil, don't copy** — content is restructured into a wiki reader's perspective, not reproduced verbatim
- **Recency bias** — when sources conflict, more recently modified content wins
- **Wikilinks for cross-references** — use `[[slug]]` instead of duplicating content from another page
- **Frontmatter completeness** — all fields (slug, title, category, tags, summary) are returned so they can be written atomically

### Key parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| Model | Sonnet 4.6 | High-quality synthesis and coherent prose |
| Retry attempts | 3 | Resilience against subagent failures |

### Trade-offs

- **Quality over speed** — running Sonnet on every group (rather than just large ones) ensures consistent output quality but increases cost and latency for simple single-extract groups
- **Merge fidelity** — the merge variant must preserve existing page structure and voice while adding new information; tension arises when the existing page uses different conventions than the new extracts

## End-to-End Data Flow

```
Source files
    │
    ▼  (parallel, batches of 10)
[Map: Haiku per file]
    │  → /tmp/.../map/<filename>.json
    ▼
[Group: deterministic code]
    │  → /tmp/.../groups.json
    ▼  (parallel, one Sonnet per group)
[Reduce: Sonnet per group]
    │  → /tmp/.../reduce/<slug>.json
    ▼
Wiki pages written (or staged for preview)
```

## Related

- [[bootstrapping]] — the skill that orchestrates this algorithm end-to-end
- [[category-taxonomy]] — consulted by both map and reduce phases to assign and validate categories
- [[content-guidelines]] — enforced during the reduce phase to prevent duplication across pages
