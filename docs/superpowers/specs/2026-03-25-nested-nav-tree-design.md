# Nested Navigation Tree Design

**Date:** 2026-03-25
**Status:** Draft

## Summary

Add multi-tier nesting to the sidebar navigation tree. Pages can declare a `parent` page within the same category, creating an arbitrarily deep hierarchy. An `overview` flag allows pinning pages to the top of their level. Categories are fetched dynamically from the taxonomy API instead of being hardcoded.

## Data Model

Two new optional fields added to `PageFrontmatter` and `WikiPage` in `src/types.ts`:

- **`parent?: string`** — slug of the parent page. Must be in the same category. If omitted, empty, or the referenced parent doesn't exist or is in a different category, the page appears at the top level of its category.
- **`overview?: boolean`** — default `false`. Overview pages sort before alphabetical siblings at their level.

Frontmatter examples:

```yaml
# Top-level overview page
---
title: Architecture Overview
category: architecture
overview: true
---

# Nested page
---
title: Route Handlers
category: architecture
parent: server-architecture
---
```

No changes to slug format, file locations, or wikilinks. Fully backward-compatible — existing pages without these fields work exactly as they do now.

## API Changes

No new endpoints or breaking changes.

- `readPage` in `src/wiki/pages.ts` already parses all frontmatter fields via `parseFrontmatter`. The new `parent` and `overview` fields are passed through the same way as existing fields like `tags` and `summary`.
- The `GET /api/pages` response automatically includes the new fields since it returns the full `WikiPage` object (minus content).
- `PageFrontmatter` and `WikiPage` interfaces in `src/types.ts` get the two new optional fields.

## Frontend: Dynamic Categories

Replace the hardcoded `CATEGORIES` array in `PageList.tsx`:

- Add a `useTaxonomy()` hook in `usePages.ts` that fetches `GET /api/taxonomy`.
- `PageList` uses the returned categories array instead of the `CATEGORIES` constant.
- Remove the `CATEGORIES` const entirely.
- Category order: as defined in the taxonomy file, with "uncategorised" appended.
- Loading/error: same loading state as pages.

This means adding or removing categories requires only editing `category-taxonomy.md` — no frontend code changes.

## Frontend: Tree Building

The `PageList` component's grouping logic changes from flat to hierarchical:

### Tree construction (per category)

1. Collect all pages for the category.
2. Pages with no `parent` (or invalid/cross-category parent) → top-level children of the category.
3. Pages with a valid `parent` in the same category → children of that parent page.
4. Unlimited nesting depth.

### Sort order at each level

1. `overview: true` pages first.
2. Then alphabetical by title.

### Collapse/expand

- Extend the existing `collapsed: Set<string>` to track both category names and page slugs. These won't collide (categories are single lowercase words; slugs contain hyphens).
- Any node with children gets a toggle arrow (▶/▼).
- Clicking toggles that node's children visibility.

### Auto-expand

- Currently auto-expands the active page's category.
- Extend to auto-expand the full ancestor chain of the active page (parent, grandparent, etc.) so the active page is always visible.

### Rendering

- A recursive `TreeNode` component renders a page, its toggle arrow (if it has children), and its children list.
- Each nesting level gets additional left padding (building on the existing 14px pattern).
- The category level renders as before but delegates its page list to `TreeNode`.

### Visual result

```
▼ architecture
    Architecture Overview        ← overview: true, sorted first
    ▼ Server Architecture
        Route Handlers
        Middleware
    Wiki Agent System
▶ data-model
▼ ui
    ▼ Sidebar Tree Navigation
        Nav Tree Spec
```

## Validation Rules

- `parent` must reference a page that exists and shares the same `category`.
- If validation fails, the page silently falls back to top-level (no error, just a graceful degradation).
- Circular parent references are handled by the tree builder: if a page is encountered twice during traversal, it's placed at the top level.

## Wiki Updates

- **`sidebar-tree-navigation.md`** — update to describe nesting, `parent` field, `overview` flag, per-node collapse, and dynamic categories.
- **`category-taxonomy.md`** — note that categories are now fetched dynamically by the frontend.

## Scope Exclusions

- No changes to the page editor or page creation flow (parent/overview can be set by editing frontmatter directly).
- No drag-and-drop reordering.
- No visual nesting indicators beyond indentation (no tree lines/connectors).
