---
title: Wiki as Source of Truth
category: decisions
tags: [decisions, source-of-truth, wiki-design, design-principles]
summary: "The wiki is the authoritative description of the system; code is derived from it, not the other way around."
last-modified-by: agent
---

## Overview

The central architectural principle of this system is that the wiki is the living document that defines what the system is and how it works. Code is generated to match the wiki — not the reverse. When a decision is made to change how the system behaves, that change is first expressed as a wiki edit. Agents then infer what must change in the codebase and execute those changes with human approval.

This inverts the traditional documentation workflow, where code changes first and documentation lags or is omitted entirely. Here, humans shape design intent by editing the wiki; agents handle the mechanical work of translating that intent into code.

## Key Properties

### Pages Are Plain Markdown on Disk

All wiki pages are markdown files stored on disk. They are readable and editable without the system running — in a text editor, on GitHub, or anywhere plain text can be accessed. This ensures the wiki remains a durable, human-accessible record regardless of application state or tool availability.

### Wiki Edits Drive Codebase Changes

When a wiki page is changed, a reactive pipeline interprets the change and determines its consequences for the codebase. It produces a proposed set of code modifications and waits for human approval before executing. This creates a human-in-the-loop workflow where the wiki edit is the single initiation point for any system evolution.

### Code Validates Against the Wiki

Source references embedded in wiki pages — written as `[[src:...]]` — create a binding between documentation and code. On every git commit, these references are checked:

- Referenced functions are verified to exist in the codebase
- Line numbers are updated automatically if a function has moved but still exists
- Deleted or renamed functions are flagged for manual resolution

This keeps the wiki and codebase structurally honest with one another over time.

## Design Constraints and Trade-offs

**Constraint: Wiki must always reflect current intent.** If the wiki drifts from reality, the reactive pipeline will produce incorrect change proposals. Keeping the wiki accurate is a discipline that must be maintained by contributors.

**Trade-off: Slower initial changes, fewer surprises later.** Requiring a wiki edit before a code change adds a step. In return, the rationale is always documented alongside the change, and agents have enough context to act correctly.

**Trade-off: Human approval is required.** The system does not apply code changes autonomously. This is a deliberate constraint — the wiki describes intent, but a human confirms execution. This limits the blast radius of incorrect agent inference.

## Relationship to Other Components

- [[bootstrapping]] — describes how an existing codebase is initially imported into the wiki, establishing the baseline source of truth
- [[skills]] — the `/octowiki:add-page` skill is the primary tool for extending the wiki with new pages, following the structure defined in [[category-taxonomy]]
- [[category-taxonomy]] — defines the categories used to classify wiki pages, which in turn guide how agents interpret page content
- [[content-guidelines]] — defines rules for keeping wiki content non-redundant, ensuring each concept has exactly one canonical page
