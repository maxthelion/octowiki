---
title: Error Handling
category: observability
tags: [error-handling, resilience, logging, debugging]
summary: "Describes how OctoWiki handles failures across its components — watcher resilience, chat errors, race conditions, and execution agent failures — along with logging conventions for debugging."
last-modified-by: agent
---

## Overview

OctoWiki implements defensive error handling across all major components. The design philosophy is that failures should be isolated, preserved for inspection, and recoverable by the user without data loss. No component silently discards work or leaves the system in an inconsistent state.

## Watcher Resilience

The file watcher is designed to degrade gracefully when its dependencies are unavailable:

- **Haiku call failure:** The error is logged, the summary step is skipped, and the watcher retries on the next file edit. A failed AI call does not block the watching loop.
- **`qmd` CLI not installed:** The watcher starts normally but without search functionality. A warning is logged with installation instructions so the operator knows what is missing and how to restore full capability.
- **Stale `.lock` file:** On startup, OctoWiki checks whether the PID recorded in any existing lock file is still active. If the process is gone, the stale lock is cleaned up before proceeding. This prevents startup failures caused by prior unclean shutdowns.

## Chat Failures

When a chat agent call fails:

- The error is returned to the client so the user is aware of the failure.
- The page is **never partially written** — no partial edits are committed to disk.
- The user can retry the message without risk of corruption from a previous incomplete attempt.

This write-nothing-on-failure guarantee keeps page state consistent regardless of agent availability.

## Race Conditions

A page may be modified between the time a chat request reads it and the time it would write a response. OctoWiki handles this by:

1. Detecting that the page has changed since the request began.
2. Re-reading the current version of the page.
3. Retrying the operation once with the fresh content.

This prevents lost writes due to concurrent edits without requiring pessimistic locking.

## Execution Agent Failures

When a plan execution agent encounters an error mid-run:

- **Work is preserved:** The agent writes to a git branch, so any partial work completed before the failure is retained and inspectable.
- **Status is recorded:** The plan status is set to `failed`, with an error summary written alongside it.
- **User decides next steps:** The operator can inspect the branch, assess what succeeded, and decide whether to continue manually, retry, or abandon.
- **No automatic rollback:** Rollback is intentionally not automatic. Preserving partial work gives the user visibility and control.

## Logging

All errors across components are logged to `stderr` with a timestamp. Log messages include:

- Error codes and human-readable messages
- Contextual information (which component, which file, which operation)

This consistent logging format supports debugging and monitoring. When investigating an issue, `stderr` is the primary diagnostic surface.
