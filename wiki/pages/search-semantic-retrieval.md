---
title: Search and Semantic Retrieval
category: pipeline
tags: [search, semantic-search, indexing, qmd, retrieval]
summary: "How OctoWiki indexes wiki pages and serves keyword, vector, and hybrid search queries via the optional qmd CLI integration."
last-modified-by: agent
---

## Overview

OctoWiki's search pipeline transforms wiki page content into queryable indices and serves search results through a REST API. The pipeline depends on the optional `qmd` CLI tool; if `qmd` is not installed the wiki starts normally but search is unavailable.

**Input:** Markdown page files on disk, modified by the file watcher.

**Processing:** BM25 full-text indexing and vector embedding, triggered by page changes.

**Output:** Ranked search results returned by `GET /api/search`.

---

## Search Modes

Three retrieval modes are available, each optimised for a different query pattern:

| Mode | API value | qmd command | Best for |
|------|-----------|-------------|----------|
| BM25 keyword | `mode=bm25` | `qmd search "query" --json` | Known terms, fast responses |
| Semantic vector | `mode=vector` | `qmd vsearch "query" --json` | Conceptual or topic-based queries |
| Hybrid + reranking | `mode=hybrid` | `qmd query "query" --json` | Highest quality; slower |

Hybrid mode combines BM25 and vector results and reranks them. It is the recommended default for general use.

---

## Trigger Conditions

The file watcher detects modifications to wiki pages and drives two separate indexing paths:

1. **Every change** — the watcher calls `qmd update` to refresh the BM25 full-text index immediately. This keeps keyword search current with minimal latency.
2. **Significant changes only** — after Haiku interprets a change and marks it as significant, the watcher triggers `qmd embed` in the background to regenerate vector embeddings. Full embedding is slow; deferring it avoids blocking page saves.

Index updates happen during the 30-second idle phase that follows a detected file modification.

---

## Index Management

- **BM25 index** — updated on every watcher trigger via `qmd update`. Near-real-time freshness.
- **Vector embeddings** — refreshed in the background after significant changes via `qmd embed`. May lag slightly behind the BM25 index.
- **Index storage** — gitignored and regenerated on clone. No index artefacts are committed to the repository.
- **Implementation** — `src/search/qmd.ts` wraps the qmd CLI using `Bun.spawn()`.

---

## API

```
GET /api/search?q=<query>&mode=bm25|vector|hybrid
```

The server proxies the query to the appropriate qmd command and returns ranked results. If `qmd` is not installed, the endpoint returns an error and logs a warning with installation instructions — the rest of the wiki continues to function.

---

## Two-Tier Retrieval for the Planning Agent

When the planning agent needs context about related pages before making decisions, it uses a three-step retrieval strategy to balance token efficiency with context quality:

1. **Search phase** — `qmd search` returns a candidate set of pages quickly.
2. **Filter phase** — summaries are read from page frontmatter to narrow the candidate set to the genuinely relevant subset without loading full content.
3. **Read phase** — full page content is fetched only for the final relevant subset.

This approach avoids loading large amounts of irrelevant content into the agent's context window.

---

## Interactive vs Bulk Usage

- **Interactive contexts** (chat-in-page, changes feed) — use `qmd search` or `qmd vsearch` for fast, low-latency responses.
- **Bulk / bootstrapping operations** (see [[bootstrapping]]) — hybrid mode is preferred where latency is acceptable, because it produces the highest quality results.

---

## Error Handling and Graceful Degradation

- If `qmd` is not installed: the server starts normally, logs a warning with install instructions, and disables the search API. All other wiki functionality remains available.
- Index regeneration failures do not block page saves; the watcher logs the error and continues.

---

## Dependencies

- **qmd CLI** — optional external dependency. Install with `bun run install qmd`.
- **File watcher** — triggers index updates; part of the core server process.
- **Haiku** — classifies change significance to decide whether to trigger vector re-embedding.
- **Planning agent** — consumes search results as part of its context-gathering step (see [[bootstrapping]] for the agent's broader role).
