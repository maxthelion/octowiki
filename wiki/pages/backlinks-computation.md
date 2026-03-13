---
title: Backlinks Computation
category: algorithms
tags: [backlinks, reverse-references, graph, wikilinks]
summary: "The backlinks computation algorithm builds a reverse mapping from each page to the set of pages that link to it, enabling the wiki to display incoming references."
last-modified-by: agent
---

## Problem

Wikilinks are directional: page A declares a link to page B, but page B has no record of that reference. Backlinks computation solves this by inverting all outgoing links into a map of incoming references, so that any page can report which other pages point to it.

## Approach

The algorithm performs a single pass over all pages. For each page it parses the wikilinks in the page's content, then for every link that represents a page reference it records the source page as a referrer of the target page.

Only link types that constitute real page-to-page relationships are counted: `link`, `embed`, and `full-embed`. Anchor-only fragments or external URLs are ignored.

```typescript
function computeBacklinks(pagesDir: string): BacklinksMap {
  const pages = listPages(pagesDir);
  const backlinks: BacklinksMap = {};

  for (const page of pages) {
    const links = parseWikilinks(page.content);

    for (const link of links) {
      if (["link", "embed", "full-embed"].includes(link.type)) {
        if (!backlinks[link.target]) backlinks[link.target] = [];

        if (!backlinks[link.target].includes(page.slug)) {
          backlinks[link.target].push(page.slug);
        }
      }
    }
  }

  return backlinks;
}
```

## Inputs and Outputs

**Input:** A directory of wiki pages, each with a `slug` and markdown `content`.

**Output:** A `BacklinksMap` — a record keyed by target page slug, with each value being an array of source page slugs.

```typescript
type BacklinksMap = Record<string, string[]>;

// Example:
{
  "page-a": ["page-b", "page-c"],  // page-a is referenced by page-b and page-c
  "page-b": ["page-a"],              // page-b is referenced by page-a
  "page-c": []
}
```

## Complexity

- **Time:** O(n × m), where n is the number of pages and m is the average number of wikilinks per page.
- **Space:** O(k), where k is the total number of wikilinks across all pages.

For a typical wiki the page count and link density are both low, so this runs quickly on every save.

## Persistence

The computed map is stored at `wiki/.meta/backlinks.json` and recomputed whenever pages change. Two helpers manage this:

```typescript
export function loadBacklinks(filePath: string): BacklinksMap
export function saveBacklinks(filePath: string, backlinks: BacklinksMap): void
```

## Usage

```typescript
const backlinks = computeBacklinks("/wiki/pages");
const referencingPages = backlinks["road-network"] || [];
// Returns array of page slugs that link to road-network
```

The result is consumed by the UI to render "referenced by" sections on each page. See [[sidebar-tree-navigation]] for how page relationships surface in navigation.

## Trade-offs

- The full recompute approach is simple and correct. An incremental strategy (only reprocessing changed pages) would be faster at scale but adds complexity and invalidation edge cases.
- Deduplication of source slugs (`includes` check) keeps the output clean but adds a linear scan per link. At realistic wiki sizes this cost is negligible.
