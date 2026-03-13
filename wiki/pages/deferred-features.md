---
title: Deferred Features
category: decisions
tags: [roadmap, scope, v1, decisions]
summary: "Records the features explicitly excluded from OctoWiki v1 — bootstrapping plugin, desktop extension, git reference validation hooks, and multi-repo support — along with the rationale for deferring each."
last-modified-by: agent
---

## Overview

The OctoWiki v1 design explicitly excludes a set of features that were considered during initial specification but judged unnecessary for a working core system. Each deferral was a deliberate choice: shipping sooner with proven fundamentals outweighs adding wrapper layers or one-shot tools before the foundation is stable.

This page records what was deferred, why, and what conditions would trigger revisiting each decision. Date of decision: 2026-03-12.

## Deferred Features

### Bootstrapping Plugin

**What it is:** A tool that derives a wiki from an existing codebase — scanning source files, extracting topics, and populating the wiki in bulk. See [[bootstrapping]] for how this was ultimately implemented.

**Why deferred:** Classified as a one-shot import tool rather than core infrastructure. The planned form was a separate package (CLI plugin or standalone tool), and no architectural decisions in the core system were blocked on it. Building it before the core was stable would risk designing the import interface around an incomplete API.

**Status:** Subsequently implemented as the batch-import skill. See [[bootstrapping]] and [[skills]].

### Desktop Extension / `.mcpb` Packaging

**What it is:** Packaging OctoWiki as a Claude Desktop Extension, with an `.mcpb` bundle and a desktop-native UX layer.

**Why deferred (OQ-13):** A standalone CLI-first approach was chosen for v1. The desktop extension is a wrapper layer — it maps MCP tool interfaces directly to existing API routes without requiring new architectural decisions. Adding the wrapper before the routes were stable would mean reworking it. The CLI-first approach also keeps the surface area small and testable.

**Consequence:** The MCP tool interface should be designed to map cleanly to API routes, so the desktop wrapper can be added later without refactoring.

### Git Reference Validation Hooks

**What it is:** Post-commit git hooks that verify `[[src:...]]` source references in wiki pages still point to valid locations in the repository. Planned as a `git hook installer` command.

**Why deferred:** These hooks require the wiki to already be populated with source-referenced pages before they are useful. Running them on an empty or partially-populated wiki produces noise. The correct sequencing is: populate the wiki first, then enforce reference integrity.

**Consequence:** `[[src:...]]` references written during v1 may go stale before the hooks are introduced. This is an accepted risk given the early stage.

### Monorepo / Multi-Repo Support

**What it is:** Ability to associate a single OctoWiki instance with multiple repositories, or to run within a monorepo where multiple packages each have their own wiki sections.

**Why deferred (OQ-11):** The v1 architecture assumes a single repo root. Multi-repo support changes path resolution, source reference handling, and potentially the sidebar tree structure. Deferral pending demonstrated user demand avoids over-engineering an assumption that may not hold in practice.

**Consequence:** The current architecture uses a single `REPO_ROOT` constant. Any future multi-repo support will require auditing all path-resolution code.

## Rationale Summary

The common thread across these deferrals is build order and proof-of-concept stability:

- **One-shot tools** (bootstrapping) are best built after the core API they depend on is stable.
- **Wrapper layers** (desktop extension) should wrap a proven interface, not an evolving one.
- **Enforcement hooks** (git reference validation) only make sense once there is content to enforce against.
- **Scope expansions** (multi-repo) wait for demonstrated need rather than speculative architecture.

This allows shipping v1 with all critical functionality — editing, rendering, navigation, and search — while leaving extension points open for each deferred feature.

## Related

- [[bootstrapping]] — the bootstrapping plugin, subsequently implemented
- [[skills]] — the batch-import skill that realises the bootstrapping capability
- [[sidebar-tree-navigation]] — navigation structure that would be affected by multi-repo support
