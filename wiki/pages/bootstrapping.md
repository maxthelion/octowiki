---
title: Bootstrapping
category: functionality
tags: [bootstrapping, setup, categories, skeleton, content-generation]
summary: Two-stage process for bootstrapping a wiki from an existing codebase — first create the skeleton, then populate with content.
last-modified-by: user
---

## Overview

Bootstrapping creates a wiki from an existing codebase. It runs in two stages: skeleton creation (fast, structural) and content population (slower, uses agents).

## Stage 1: Skeleton

Create the structural framework without generating any content. This is fast and deterministic.

### What it does

1. **Seed categories** — write `wiki/meta/taxonomy.md` with the canonical category list:
   - `architecture`, `pipeline`, `data-model`, `rendering`, `testing`, `observability`, `decisions`, `meta`, `ui`, `functionality`
   - Include descriptions for each category
   - Add an initial tag vocabulary based on the repo's tech stack

2. **Create stub pages** — scan the repo for key files and create empty pages with frontmatter only:
   - README → overview page
   - Source directories → one page per major module/package
   - Config files → reference pages
   - Test directories → testing pages
   - Each stub gets: title, category, tags, empty summary, `last-modified-by: agent`

3. **Build the backlinks index** — run `qmd update` to index the stubs

### Output

A wiki with the right shape — correct categories, pages in the right places, wikilinks between related stubs — but no prose content yet.

## Stage 2: Content Population

Fill in the stub pages with actual content. This is slower and requires agent calls.

### What it does

1. **Read source files** — for each stub page, read the corresponding source files
2. **Generate content** — use an agent (Sonnet) to write wiki content from the source:
   - Distill, don't copy — wiki pages should explain, not duplicate
   - Add `[[wikilinks]]` to related pages
   - Preserve important code references with `[[src:file.ts#function]]` syntax
3. **Generate summaries** — fill in the `summary` field in frontmatter
4. **Update the index** — run `qmd update` and `qmd embed` for search

### Output

A fully populated wiki ready for use. Pages have real content, cross-references, and searchable summaries.

## Current State

The batch import system (`/octowiki:batch-import` skill) implements both stages using a map-reduce architecture:

1. **Discover** — a Bun script (`src/batch-import/discover.ts`) finds markdown files and creates a manifest with git dates
2. **Map** — Haiku subagents extract structured topic summaries from each file, checking for duplicates via qmd search
3. **Group** — deterministic code merges extracts by topic, resolving category conflicts and filtering low-confidence results
4. **Reduce** — Sonnet subagents synthesise grouped extracts into coherent wiki pages following [[content-guidelines]]
5. **Create** — pages are written via the [[skills|add-page skill]] to a staging directory for preview before applying

Everything stages in `/tmp/` — nothing touches the wiki until the user confirms.

Usage: `/octowiki:batch-import <repo-path> [--dry-run] [--force]`

## Related

- [[wiki-agent-system-spec]] — Section 11 describes the bootstrapping plugin
- [[design-spec]] — defers bootstrapping to a future version
- [[sidebar-tree-navigation]] — categories from the skeleton appear in the sidebar tree
