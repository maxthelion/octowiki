---
title: Markdown Rendering
category: rendering
tags: [markdown, wikilinks, rendering, ui]
summary: "OctoWiki renders wiki page content using markdown-it with a custom wikilink plugin that supports eight link types, source code references, hover summaries, and embeds."
last-modified-by: agent
---

## Overview

OctoWiki renders wiki page content using [markdown-it](https://github.com/markdown-it/markdown-it) extended with a custom inline rule that handles `[[wikilink]]` syntax. The renderer runs on the frontend inside the `PageView` component, converting stored markdown to HTML that React mounts via `dangerouslySetInnerHTML`. Interactive features — hover summaries, expandable source blocks — are attached through `data-*` attributes that React components read at mount time.

## markdown-it Configuration

The markdown-it instance is created with two options enabled:

```typescript
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: true,      // Allow raw HTML in page content
  linkify: true    // Auto-link bare URLs
});
```

Raw HTML is permitted so that wiki pages can embed arbitrary markup where needed. URL linkification handles plain `https://` references without requiring explicit anchor tags.

## Custom Wikilink Plugin

A custom inline rule is pushed onto `md.inline.ruler` to handle the `[[...]]` syntax. The rule:

1. Matches `[[` at the current position in the token stream
2. Finds the closing `]]`
3. Pushes a `wikilink` token containing the inner text
4. Advances the parser position past the closing brackets

A custom renderer rule then converts each token to HTML based on the link type detected in the inner content:

```typescript
md.inline.ruler.push("wikilink", (state, silent) => {
  // Match [[ at current position
  // Find closing ]]
  // Push token to state
  // Advance position
});

md.renderer.rules.wikilink = (tokens, idx) => {
  const inner = tokens[idx].content;
  // Parse inner content and generate appropriate HTML
};
```

## Wikilink Types and Output HTML

The plugin recognises the following link forms and emits distinct HTML for each.

### Standard page link — `[[page-name]]`

```html
<a href="/page/page-name" class="wiki-link" data-target="page-name">page-name</a>
```

The `data-target` attribute is read by the `HoverSummary` component to fetch and display the target page's frontmatter summary on hover.

### Labelled link — `[[page-name|Label]]`

Same output as a standard link but uses the supplied label as link text instead of the slug.

### Anchor link — `[[page-name#section]]`

Generates a link whose `href` includes the fragment identifier, scrolling the reader to the named section on the target page.

### Embed — `[[!page-name]]`

```html
<div class="wiki-embed" data-target="page-name">
  <a href="/page/page-name">page-name</a>
</div>
```

### Full embed — `[[!!page-name]]`

```html
<div class="wiki-embed wiki-embed-full" data-target="page-name">
  <a href="/page/page-name">page-name</a> (full embed)
</div>
```

### Source reference — `[[src:path/to/file.ts:functionName]]` or `[[src:path/to/file.ts:10-20]]`

```html
<code class="wiki-src" data-file="file.ts" data-anchor="functionName">
  file.ts#functionName
</code>
```

Function-name references are preferred over line-number ranges because line numbers shift as code changes. The `SourceBlock` component reads the `data-file` and `data-anchor` attributes and renders an expandable, syntax-highlighted code block. See [[sidebar-tree-navigation]] for how source files are navigated in the UI.

### Reference — `[[ref:type:target#anchor]]`

```html
<span class="wiki-ref" data-type="type" data-target="target">
  type:target
</span>
```

Used for structured cross-references where the link type carries semantic meaning (e.g. linking to an issue tracker entry or external document type).

## PageView Component

The `PageView` component is the entry point for rendering a wiki page:

```typescript
function renderMarkdown(content: string): string {
  return md.render(content);
}

// Inside PageView
<div
  className="wiki-content"
  dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
/>
```

After the HTML is mounted, React components scan for `data-*` attributes to attach interactivity.

## Interactive Enhancements

### HoverSummary

Wikilinks with a `data-target` attribute trigger the `HoverSummary` component on hover. It fetches the target page's `summary` field from frontmatter and displays it in a tooltip, giving readers quick context without requiring navigation.

### SourceBlock

Source references (`[[src:...]]`) render as collapsible code blocks via the `SourceBlock` component. Syntax highlighting is applied based on file extension. Collapsed by default, the block expands on click to show the referenced function or line range.

### Backlinks

Incoming links to the current page are surfaced in the sidebar. This is not part of the markdown pipeline itself — backlinks are computed separately and passed to the sidebar component — but they depend on the same wikilink parsing to extract link targets from page content.

## Input and Output

| Input | Output |
|-------|--------|
| Markdown string with optional `[[wikilinks]]` | HTML string |
| Frontmatter is stripped before rendering | `data-*` attributes on interactive elements |
| Raw HTML in content is passed through | CSS classes: `wiki-link`, `wiki-embed`, `wiki-src`, `wiki-ref` |

## Browser Considerations

The renderer runs entirely in the browser; there is no server-side rendering step for page content. This means the initial paint shows unstyled or empty content until the React component mounts and `dangerouslySetInnerHTML` is populated. Hover summaries and source blocks require JavaScript to function — they degrade to static links and inline code respectively without it.
