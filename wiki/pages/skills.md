---
title: Skills
category: functionality
tags: [skills, automation, add-page, agents, cli]
summary: Skills are slash-command shortcuts that automate common wiki tasks, starting with the add-page skill for creating structured wiki pages.
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

## Adding New Skills

Skills follow the pattern:
```
.claude/skills/<skill-name>/SKILL.md
```

Each skill has YAML frontmatter with `name` and `description` (triggering conditions), and a body describing the steps. Reference `CLAUDE.md` to ensure the skill is invoked when relevant.

## Related

- [[category-taxonomy]] — the canonical category reference that the add-page skill reads
- [[bootstrapping]] — batch page creation uses similar category-matching logic
- [[agent-activity-indicator]] — skills trigger agent work that should be visible in the UI
- [[content-guidelines]] — rules for avoiding duplication across wiki pages
