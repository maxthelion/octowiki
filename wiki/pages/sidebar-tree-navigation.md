---
title: Sidebar Tree Navigation
category: ui
tags: [navigation, sidebar, categories, tree-view]
summary: The sidebar should display pages grouped under top-level categories in a collapsible tree.
last-modified-by: user
---

## Overview

The left sidebar should show a tree navigation with top-level categories as group headers. Pages are listed under their category. This replaces the current flat list.

## Structure

```
▼ architecture
    Design Spec
    Wiki Agent System Spec
▼ ui
    Sidebar Tree Navigation
▼ functionality
    Bootstrapping
▶ pipeline
▶ data-model
▶ testing
▶ observability
▶ decisions
▶ meta
```

## Behaviour

- Categories are collapsible — click to expand/collapse
- Categories with no pages are shown but greyed out
- Active page is highlighted (as it is now)
- Category headers are not clickable links — just group labels
- Sort categories alphabetically, pages alphabetically within each category
- Empty categories still appear so the user knows the full taxonomy

## Categories

The canonical top-level categories from the [[wiki-agent-system-spec]]:

- `architecture` — system structure and design
- `pipeline` — data flow and processing
- `data-model` — schemas, types, storage
- `rendering` — display and presentation
- `testing` — test strategy and coverage
- `observability` — logging, monitoring, debugging
- `decisions` — architectural decision records
- `meta` — wiki-about-the-wiki
- `ui` — user interface design and components
- `functionality` — features and capabilities

## Notes

- The category list should come from `wiki/meta/taxonomy.md` once that's populated
- Pages without a category (or with an unrecognised one) should appear under an "Uncategorised" group at the bottom
- The Feed, Inbox, and Search links should remain at the top of the sidebar above the tree
