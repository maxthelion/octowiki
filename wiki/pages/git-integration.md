---
title: Git Integration and Reference Validation
category: pipeline
tags: [git, references, validation, hooks]
summary: "A post-commit hook keeps wiki source references accurate by validating, auto-updating, and flagging broken or stale links to codebase functions and lines."
last-modified-by: agent
---

## Overview

The wiki maintains bidirectional references with the codebase using `[[src:...]]` syntax. A post-commit git hook runs after every commit to ensure those references remain accurate, auto-correcting what it can and flagging what requires human attention.

This pipeline is triggered automatically — no manual step is needed. Its inputs are the current git commit and all wiki pages containing source references; its outputs are updated pages and flagged review items.

## Trigger Conditions

The pipeline runs as a **post-commit hook**. It fires on every commit to the repository, scanning all wiki pages for `[[src:...]]` references before performing validation.

## Reference Validation Steps

For each source reference found, the hook applies the following logic in order:

1. **Function references still exist** — the referenced function name is looked up in the current codebase. If found, the reference is valid.
2. **Line references are auto-updated** — if a function has moved within its file, the hook updates the stored line numbers automatically.
3. **Deleted or renamed functions are flagged** — if the referenced function no longer exists, the page is marked for human resolution. No automatic change is made.
4. **Ambiguous cases are suggested** — where multiple candidate functions could match a deleted reference, an AI model suggests the most likely replacement for the human to confirm.

## Freshness Metadata

Each source reference carries a timestamp or commit SHA recording when it was last verified. The hook also checks whether the referenced file has changed substantially since the reference was made. Pages where this is true are flagged as **worth reviewing** — the reference may not be broken, but it may now describe outdated behaviour.

## Function References vs Line References

The system distinguishes two kinds of source reference:

- **Function references** (`#functionName`) — preferred. Durable across refactors and file reorganisation. As long as the function name survives, the reference stays valid.
- **Line references** (`#142-167`) — fragile. Any insertion or deletion above the target shifts the numbers. The hook will auto-update these when it can, but they are more maintenance-intensive.

Where a choice exists, function references should be used. Line references are appropriate only when referencing a block of code that has no enclosing function name.

## Error Handling

| Situation | Outcome |
|---|---|
| Function moved within file | Line numbers auto-updated silently |
| Function deleted or renamed | Page flagged; human resolves |
| Multiple possible matches | AI suggestion offered; human confirms |
| File changed substantially | Page flagged as stale for review |

The hook never silently drops a reference or makes ambiguous edits without surfacing them.

## Dependencies

This pipeline depends on:

- The git commit graph (for commit SHA provenance and diff detection)
- The wiki page store (to read and write `[[src:...]]` references)
- An AI model (Haiku) for resolving ambiguous reference suggestions

See [[bootstrapping]] for how wiki pages are initially populated with source references, and [[content-guidelines]] for conventions around when and how to use `[[src:...]]` links.
