---
title: Tag Auto-Apply Pipeline
category: pipeline
tags: [pipeline, tags, agents, metadata, audit]
summary: "The tag auto-apply pipeline uses a Haiku agent to analyse page content, suggest relevant tags, apply them directly to frontmatter, and record the change in per-page metadata for auditability and undo support."
last-modified-by: agent
---

## Overview

OctoWiki automatically improves tagging consistency over time by running a lightweight agent pipeline against wiki pages. Rather than prompting the user for approval on every suggestion, tags are applied immediately and all changes are recorded in a metadata audit trail. This keeps the workflow non-blocking while ensuring every change remains visible and reversible.

## Trigger Conditions

The pipeline is invoked against a wiki page when:

- A page is created or significantly updated
- A batch import run completes and new pages are written to disk
- An operator explicitly requests a re-tagging pass

## Pipeline Steps

### 1. Content Analysis

A Haiku agent reads the full content of the target page, including its existing frontmatter. It reasons about the topics covered and produces a list of tags that accurately describe the page.

### 2. Tag Suggestion

The agent returns a suggested tag set. Suggestions are constrained to tags that are meaningful given the page's category — see [[category-taxonomy]] for the category definitions that shape what tags are appropriate.

### 3. Frontmatter Application

The suggested tags are written directly into the page's frontmatter `tags` field, replacing or augmenting the existing set. No interactive approval step is required; the change is committed immediately.

### 4. Metadata Logging

After application, the pipeline records the change to `.meta/pages/<page-slug>.json`. Each log entry contains:

- **Previous tag set** — the tags that existed before the change
- **Suggested tags** — the tags that were added or set
- **Timestamp** — when the application occurred

This entry is appended to the file's history so the full sequence of tag changes can be inspected.

## Undo Support

Because the previous tag set is always preserved in metadata before any change is applied, reverting a tag-apply is straightforward:

1. Read the relevant entry from `.meta/pages/<page-slug>.json`
2. Write the recorded previous tag set back into the page's frontmatter

No special tooling is required beyond the ability to read metadata and write frontmatter. The metadata store is intentionally hidden from the main wiki presentation layer so it does not clutter the reading experience.

## Error Handling

- If the Haiku agent fails or returns an empty suggestion, the page's existing tags are left unchanged and no metadata entry is written.
- Metadata write failures are logged but do not prevent the frontmatter update from being applied; the change proceeds with a warning that the audit entry could not be saved.

## Dependencies

- **Haiku agent** — performs the content analysis and tag suggestion step
- **[[skills]]** — the batch-import skill triggers this pipeline after pages are written during a bulk import run
- **Frontmatter schema** — the `tags` field must be present and array-typed; see the page frontmatter conventions described in [[content-guidelines]]

## Design Rationale

Auto-applying without an approval gate was a deliberate choice. Requiring user confirmation for every tag suggestion would block automated workflows and introduce friction during batch operations. The audit trail in `.meta/` provides the same safety guarantee — changes are always reversible — without requiring the user to be present at the time of application. The metadata directory is kept separate from the main wiki tree so it remains invisible to readers browsing pages.
