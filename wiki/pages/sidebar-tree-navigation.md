---
title: Sidebar Tree Navigation
category: ui
tags: [navigation, sidebar, categories, tree-view]
summary: The sidebar displays pages grouped under top-level categories in a collapsible nested tree, supporting parent–child page relationships, overview sorting, and dynamic category loading.
last-modified-by: user
---

## Overview

The left sidebar shows a tree navigation with top-level categories as group headers. Pages are listed under their category, and pages can declare a parent page within the same category to form a nested hierarchy. This replaces the earlier flat two-level tree (categories → pages).

## Structure

```
▼ architecture
    System Architecture         ← overview: true, sorted first
    ▼ Server Architecture
        Route Handlers          ← parent: server-architecture
        Middleware              ← parent: server-architecture
    Wiki Agent System
▶ data-model
▼ ui
    Sidebar Tree Navigation
```

## Frontmatter Fields

### `parent`

Pages can declare a parent page within the same category using `parent: <slug>`. A page with a valid `parent` appears nested beneath that parent in the tree rather than at the top level of its category.

Rules:
- The parent must be a page in the same category. Cross-category parents are ignored and the page falls back to top-level.
- If the referenced slug does not exist, the page falls back to top-level.
- Circular references are detected and broken — the offending page falls back to top-level.

### `overview`

Pages with `overview: true` sort before all other pages at their level (within a category or within a parent page's children). Intended for the primary introductory page of a category or subsection.

## Behaviour

- Categories are collapsible — click to expand/collapse
- Any page that has children can also be collapsed/expanded, not just category headers
- When navigating to a nested page, its entire ancestor chain (category + all parent pages) auto-expands so the active page is always visible
- Categories with no pages are shown but greyed out
- Active page is highlighted
- Category headers are not clickable links — just group labels
- Pages with `overview: true` sort first at their level; remaining pages sort alphabetically
- Empty categories still appear so the user knows the full taxonomy
- Pages without a category (or with an unrecognised one) appear under an "Uncategorised" group at the bottom

## Categories

Categories are fetched dynamically from the taxonomy API (`GET /api/taxonomy`) rather than being hardcoded in the frontend. Category order in the sidebar follows the order of headings in [[category-taxonomy]]. This means adding or removing a category in the taxonomy file automatically updates the navigation without a frontend change.

The canonical top-level categories from [[category-taxonomy]]:

- `architecture` — system structure and design
- `pipeline` — data flow and processing
- `data-model` — schemas, types, storage
- `rendering` — display and presentation
- `testing` — test strategy and coverage
- `observability` — logging, monitoring, debugging
- `decisions` — architectural decision records
- `meta` — wiki-about-the-wiki
- `ui` — user interface design and components
- `algorithms` — computational approaches and heuristics
- `functionality` — features and capabilities

## Notes

- The Feed, Inbox, and Search links remain at the top of the sidebar above the tree
- Graceful fallback applies to all invalid parent references: invalid slug, cross-category reference, and circular chains all result in the page appearing at the top level of its category
