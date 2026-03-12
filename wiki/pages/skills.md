---
title: Skills
category: functionality
tags: [skills, automation, add-page, batch-import, agents, cli]
summary: Skills are slash-command shortcuts that automate common wiki tasks — add-page for creating individual pages and batch-import for bulk documentation import.
last-modified-by: user
---

## Overview

Skills are reusable slash commands that Claude Code can invoke to perform wiki tasks. They live in `.claude/skills/` and are triggered by `/skillname` in conversation. Skills encode the wiki's conventions so pages are created consistently without the user needing to remember the taxonomy, frontmatter format, or linking conventions.

## Available Skills

### /octowiki:add-page

**Purpose:** Create a new wiki page from a user prompt.

**Usage:**
```
/octowiki:add-page <prompt>
```

**What it does:**

1. Reads the [[category-taxonomy]] to understand what each category expects
2. Checks existing pages to avoid slug collisions
3. Derives slug, title, category, tags, and summary from the prompt
4. Writes a structured page to `wiki/pages/<slug>.md`
5. Confirms creation with the page path and assigned category

**What makes it work well:**

- **Category-aware** — reads the taxonomy page before choosing a category, not a hardcoded list. This means if categories are added or descriptions refined, the skill picks it up automatically.
- **Content structuring** — doesn't just dump the user's text. Organises it with headings, lists, and sections following the category's guidelines (see [[category-taxonomy]]).
- **Cross-referencing** — adds `[[wikilinks]]` to related pages where relevant, building the wiki's link graph.
- **Frontmatter consistency** — always sets `last-modified-by: user`, generates a summary, picks appropriate tags.
- **Collision-safe** — checks existing slugs and appends a number if needed.

**Key design decisions:**

- The skill reads the taxonomy at runtime rather than embedding category rules. This keeps the skill simple and the taxonomy as the single source of truth.
- Pages are attributed to `user` not `agent` because the user initiated the creation — even though an agent structured the content.
- The skill is defined in `.claude/skills/octowiki-add-page/SKILL.md` and referenced in `CLAUDE.md` so it's invoked automatically when the user asks to create a page.

**Location:** `.claude/skills/octowiki-add-page/SKILL.md`

### /octowiki:batch-import

**Purpose:** Import and consolidate documentation from a repository into structured wiki pages.

**Usage:**
```
/octowiki:batch-import <repo-path> [--dry-run] [--force]
```

**What it does:**

Uses a map-reduce pipeline to transform markdown files into wiki pages:

1. **Discover** — Bun script finds markdown files, creates a manifest with git dates and content
2. **Index** — refreshes the qmd search index (if available)
3. **Map** — Haiku subagents extract wiki-worthy topics from each file in parallel (batches of 10), checking for overlaps with existing pages
4. **Group** — deterministic code merges extracts by topic slug, deduplicates tags, filters below a 0.3 confidence threshold
5. **Reduce** — Sonnet subagents synthesise grouped extracts into coherent wiki pages following [[category-taxonomy]] guidelines and [[content-guidelines]]
6. **Create** — writes pages to a staging directory with slug collision detection
7. **Preview** — shows summary of new pages, merges, and skipped files
8. **Apply** — on confirmation, stages the result as a previewable wiki tree

**Staging approach:**

Rather than writing directly to `wiki/pages/`, the apply step:

1. Copies the current `wiki/pages/` to `wiki/pages-pre-import/` as a backup
2. Creates a new `wiki/pages/` containing both existing and new/merged pages
3. The user can browse the wiki to preview the full result
4. If satisfied, delete `wiki/pages-pre-import/` and commit
5. If reverting, swap `wiki/pages-pre-import/` back to `wiki/pages/`

This allows the user to view the complete modified wiki tree before committing to the import.

**Key design decisions:**

- **Full taxonomy in map prompts** — Haiku subagents receive the complete [[category-taxonomy]] including "What belongs here" and "Pages should contain" sections, not just category names. Without the full descriptions, category assignments are unreliable.
- **Every group through Sonnet** — even single-extract groups go through Sonnet synthesis. The value isn't just merging multiple sources — it's restructuring content into a proper wiki page with headings, sections, and cross-references. Passing single extracts through verbatim produces terse, unstructured pages.
- Pages are attributed to `agent` since they are machine-generated from existing documentation.
- The `--dry-run` flag stops after preview without staging anything.
- The `--force` flag allows imports with >200 discovered files.

**Location:** `.claude/skills/octowiki-batch-import/SKILL.md`

## Adding New Skills

Skills follow the pattern:
```
.claude/skills/<skill-name>/SKILL.md
```

Each skill has YAML frontmatter with `name` and `description` (triggering conditions), and a body describing the steps. Reference `CLAUDE.md` to ensure the skill is invoked when relevant.

## Related

- [[category-taxonomy]] — the canonical category reference that both skills read
- [[bootstrapping]] — describes the bootstrapping workflow that batch-import implements
- [[agent-activity-indicator]] — skills trigger agent work that should be visible in the UI
- [[content-guidelines]] — rules for avoiding duplication across wiki pages
