---
title: Taxonomy System
category: data-model
tags: [taxonomy, classification, organization, tags]
summary: "Describes the two complementary classification systems — categories and tags — that every wiki page belongs to, including how the tag vocabulary is managed and where the taxonomy is consulted across agent workflows."
last-modified-by: agent
---

## Overview

Every wiki page is classified using two complementary systems: **categories** (structural, mutually exclusive) and **tags** (cross-cutting, multiple allowed). Together they let both humans and agents reason about where content belongs and how concepts relate across the wiki.

The canonical category definitions and per-category content guidelines live in [[category-taxonomy]]. This page describes the data model of the taxonomy system itself — how the two systems are structured, how the tag vocabulary is stored and evolved, and where the taxonomy is consulted during automated workflows.

## Categories

Each page belongs to exactly one category. Categories reflect the shape of the system, not the shape of the code. The category set is fixed and defined in [[category-taxonomy]].

In page frontmatter, the category is expressed as a single string value:

```yaml
category: data-model
```

Valid values are the slugs listed in [[category-taxonomy]].

## Tags

Tags capture cross-cutting concerns that span categories. A page may have multiple tags. They are expressed in frontmatter as a YAML list:

```yaml
tags: [taxonomy, classification, organization]
```

The canonical tag vocabulary is maintained in `taxonomy.md`. This file acts as the single source of truth for which tags exist. When agents suggest or apply tags, they consult this file to stay within the established vocabulary.

## Smart Tagging

When Haiku generates a change summary for a modified page, it performs smart tagging by:

1. Reading `taxonomy.md` for the current tag vocabulary
2. Suggesting tags for the changed page from existing tags
3. Flagging if a new tag concept seems warranted, for human confirmation before it is added to the vocabulary
4. Detecting near-duplicate tags and suggesting consolidation where the vocabulary has drifted

Changes to `taxonomy.md` are treated as ordinary wiki changes and propagate through the normal reactive pipeline — they are not treated specially.

## Page Frontmatter Schema

A complete page frontmatter block combines both classification fields with descriptive metadata:

```yaml
---
title: Page Title
category: <category-slug>
tags: [tag-one, tag-two]
summary: One sentence describing the page.
last-modified-by: <agent | user>
---
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Human-readable page title |
| `category` | string | yes | Exactly one category slug from [[category-taxonomy]] |
| `tags` | string[] | yes | Zero or more tags from the vocabulary in `taxonomy.md` |
| `summary` | string | yes | One sentence describing the page's content |
| `last-modified-by` | string | yes | Either `user` or the agent/skill that last wrote the page |

## Integration with Agent Workflows

The taxonomy is consulted by several parts of the system:

- **[[bootstrapping]]** — during initial wiki population, source files are classified into pages using the category taxonomy to determine where each piece of information belongs.
- **Add-page skill** (see [[skills]]) — when creating a new page, the skill reads [[category-taxonomy]] to help choose the correct category.
- **Smart tagging** — the Haiku-powered change summary agent reads `taxonomy.md` to suggest and validate tags on modified pages.
