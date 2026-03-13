---
title: Add Page Flow
category: pipeline
tags: [page-creation, agents, pipeline, ui]
summary: Describes the end-to-end pipeline for creating a new wiki page — from user input through agent-assisted structuring to file write and automatic indexing.
last-modified-by: agent
---

## Overview

The add page flow is the pipeline triggered when a user creates a new wiki page via `POST /api/pages`. It takes raw user notes and optional context, uses an agent to infer structure and metadata, writes the page to disk, and hands off to the file watcher for automatic indexing.

The pipeline is designed to preserve user intent while enforcing consistent page structure. The agent shapes content into the wiki's conventions, but the original user notes are always retained verbatim as provenance.

## Input

The pipeline accepts three inputs from the client:

- **User notes** — free-form textarea content describing the topic
- **Category** (optional) — a selection from the [[category-taxonomy]] dropdown
- **Related page slugs** (optional) — existing pages to seed the agent's context

## Processing Steps

### 1. Context Gathering

The agent reads the user's notes alongside the summaries of any related pages provided. This gives it enough context to make informed decisions about title, category, and tags without needing to reproduce the content of those pages.

If a category was not selected by the user, the agent infers one by consulting [[category-taxonomy]] and matching the content to the most appropriate category definition.

### 2. Metadata Inference

From the gathered context, the agent determines:

- **Filename** — derived as a kebab-case slug from the inferred or supplied title
- **Title** — a human-readable heading
- **Category** — confirmed or inferred from the taxonomy
- **Tags** — 2–5 relevant tags drawn from the content
- **Summary** — one sentence describing the page

### 3. Page Write

The agent writes a fully structured page to `/wiki/pages/<slug>.md` with:

- YAML frontmatter containing all required metadata fields (`title`, `category`, `tags`, `summary`, `last-modified-by`)
- Organised content sections using `##` headings
- `[[wikilinks]]` to any related pages identified during context gathering
- A `## Notes` section at the end containing the user's raw input verbatim

### 4. Automatic Indexing

Once the file lands on disk, the file watcher picks it up on its next cycle and:

- Generates a summary for the new page
- Updates backlinks across the wiki
- Refreshes the qmd index

This step is handled entirely by the watcher — the add page pipeline does not need to trigger it explicitly.

## Output

The API returns the new page's slug to the client, which uses it to navigate directly to the newly created page.

## Preserving User Intent

The `## Notes` section is permanent provenance. It captures the user's original thinking before any agent shaping occurred. If the agent-generated structure or content later diverges from what the user intended, the original notes remain visible at the bottom of the page as a reference point.

## Error Handling

The pipeline does not currently define retry behaviour. If the agent fails to write the page, the API returns an error to the client. The file watcher operates independently and will not be affected.

## Dependencies

- [[category-taxonomy]] — consulted by the agent to validate or infer category and to apply the appropriate content structure guidelines
- [[skills]] — the `/octowiki:add-page` skill wraps this pipeline for use from the Claude Code CLI
- File watcher — downstream consumer that handles summary generation and index updates after the file is written
