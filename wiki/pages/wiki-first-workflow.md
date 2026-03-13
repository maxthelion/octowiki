---
title: Wiki-First Workflow
category: meta
tags: [workflow, documentation, source-of-truth, conventions]
summary: The wiki is the source of truth — update or create the relevant wiki page before implementing any change to the system.
last-modified-by: agent
---

## Overview

When a change is requested — whether a new feature, a bug fix, or a refactor — the first step is always to update the wiki. The wiki describes what the system should do; code is derived from it.

This means: **the wiki is updated before implementation begins, not after.**

## The Workflow

For any change:

1. Identify which wiki page(s) describe the thing being changed
2. Update or create those page(s) to reflect the desired state
3. Only after the wiki change is confirmed, proceed to implementation

If no page exists for the concept being changed, create one first. See [[skills]] for the `/octowiki:add-page` skill, which structures new pages according to the [[category-taxonomy]].

## Why Wiki-First

Writing the wiki page first forces clarity about what is actually being built before any code is written. It also keeps the wiki accurate — if documentation is written after the fact, it tends to drift or get skipped entirely.

The wiki is the single source of truth for how the system works. Code that contradicts the wiki is the thing that is wrong.

## Scope

This workflow applies to:

- **New features** — the feature page should describe intended behaviour before implementation
- **Bug fixes** — if the bug reflects a misunderstanding of intended behaviour, update the relevant page to clarify it
- **Refactors** — if internal structure changes, update [[category-taxonomy]]-appropriate pages to reflect the new shape

## Related

- [[skills]] — the `/octowiki:add-page` skill for creating new pages
- [[category-taxonomy]] — how pages are classified
- [[content-guidelines]] — rules for writing wiki content without duplication
- [[bootstrapping]] — how the wiki is initially populated from existing documentation
