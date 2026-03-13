---
title: Wikilinks Syntax
category: data-model
tags: [wikilinks, syntax, references, embedding, data-model]
summary: "Defines the eight wikilink types OctoWiki supports, their syntax, the WikiLink data structure, and how the parser resolves each variant."
last-modified-by: agent
---

## Overview

OctoWiki extends standard Markdown with a wikilink syntax enclosed in double brackets: `[[...]]`. Eight distinct link types are recognised, covering page navigation, content embedding, and references to external systems such as source code, git history, pull requests, and tests.

## Link Types

| Syntax | Type | Behaviour |
|--------|------|-----------|
| `[[page-slug]]` | Link | Navigate to a wiki page; hover shows the page's summary tooltip |
| `[[!page-slug]]` | Embed (summary) | Inline the page title and summary at this location |
| `[[!!page-slug]]` | Full embed | Inline the complete page content at this location |
| `[[src:file.ts#functionName]]` | Source ref (function) | Reference a named function or class in a source file |
| `[[src:file.ts#142-167]]` | Source ref (lines) | Reference a specific line range in a source file |
| `[[ref:git:abc123f]]` | Git ref | Reference a specific commit or branch |
| `[[ref:pr:47]]` | PR ref | Reference a pull request by number |
| `[[ref:doc:README.md#section]]` | Doc ref | Reference a section in an external document |
| `[[ref:test:road.test.ts#L42]]` | Test ref | Reference a specific test by file and line |

### Embed Variants

- `[[!page-slug]]` — partial embed: includes the page's summary and a content preview without the full body.
- `[[!!page-slug]]` — full embed: inserts the entire page content inline. Use sparingly; prefer linking when the target page is long.

### Source References

Function references (`#functionName`) are preferred over line references (`#142-167`) because they survive most refactors. A git post-commit hook auto-updates stale line number references when a referenced function moves.

Source references render as collapsible inline code blocks with syntax highlighting:
- **Hover** shows the function signature and docstring.
- **Click** expands the full code block in place.

## WikiLink Data Structure

The parser (`src/wiki/wikilinks.ts`) normalises every matched token into a `WikiLink` object:

```typescript
interface WikiLink {
  raw: string;      // Full [[...]] text as it appeared in source
  type: "link" | "embed" | "full-embed" | "src" | "ref";
  target: string;   // Page slug, file path, commit SHA, PR number, etc.
  anchor?: string;  // Fragment: function name, line range, or section heading
  refType?: "git" | "pr" | "doc" | "test";  // Discriminator for "ref" type
}
```

### Field Notes

- `raw` — preserves the original text, useful for round-trip serialisation.
- `type` — determined by the prefix inside `[[...]]` (see Parser section below).
- `anchor` — present when a `#` fragment is included; absent otherwise.
- `refType` — only set when `type === "ref"`; identifies the external system being referenced.

## Parser

The exported function `parseWikilinks` in `src/wiki/wikilinks.ts` accepts a markdown string and returns all `WikiLink` objects found within it:

```typescript
export function parseWikilinks(text: string): WikiLink[]
```

### Regex

Wikilinks are matched with: `\[\[([^\]]+)\]\]`

The captured inner content is then inspected for prefixes to determine `type`:

| Prefix | Resolved type |
|--------|---------------|
| `!!` | `full-embed` |
| `!` | `embed` |
| `src:` | `src` |
| `ref:git:` | `ref` with `refType: "git"` |
| `ref:pr:` | `ref` with `refType: "pr"` |
| `ref:doc:` | `ref` with `refType: "doc"` |
| `ref:test:` | `ref` with `refType: "test"` |
| *(none)* | `link` |

### Example

```typescript
const links = parseWikilinks(
  "See [[road-network]] and [[!blocks]] and [[src:file.ts#fn]]"
);
// Returns 3 WikiLink objects:
// { type: "link",  target: "road-network" }
// { type: "embed", target: "blocks" }
// { type: "src",   target: "file.ts", anchor: "fn" }
```

## Related

- [[sidebar-tree-navigation]] — the sidebar uses page links and backlinks derived from parsed wikilinks.
- [[content-guidelines]] — guidelines on when to link versus embed versus re-describe content.
- [[category-taxonomy]] — every page referenced by a wikilink belongs to a category defined there.
