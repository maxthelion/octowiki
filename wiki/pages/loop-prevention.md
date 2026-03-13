---
title: Loop Prevention
category: algorithms
tags: [algorithms, safety, concurrency, watcher, agent]
summary: "Three complementary mechanisms — frontmatter origin tagging, an exclusive write lock, and directory separation — that prevent OctoWiki agents from triggering infinite interpretation loops."
last-modified-by: agent
---

## Overview

When an agent writes a wiki page, the filesystem watcher would ordinarily detect that write and trigger a Haiku interpretation pass — which could in turn cause another agent write, and so on indefinitely. OctoWiki prevents this with three complementary mechanisms that together ensure agent activity is never mistaken for user intent.

Each mechanism addresses a distinct failure mode: the frontmatter tag suppresses re-interpretation of agent-written content, the write lock serialises concurrent writes, and directory separation hides agent-internal files from the watcher entirely.

## Frontmatter Origin Tag

**Problem solved:** The watcher cannot distinguish a user save from an agent save by filename alone.

**Approach:** Every page written by an agent includes a `last-modified-by: agent` field in its frontmatter. Before invoking Haiku to interpret a changed page, the watcher reads this tag. If the value is `agent`, the interpretation step is suppressed — the page still syncs to connected browsers via SSE, but no new agent work is queued.

When a user subsequently edits the page, their editor (or the wiki UI) sets the tag to `user`, re-enabling interpretation on the next save.

**Inputs:** Frontmatter of the changed file.

**Outputs:** Boolean decision — run Haiku interpretation or skip it.

**Key threshold:** The tag must be exactly `agent` to suppress; any other value (including absence of the field) allows interpretation to proceed.

**Trade-off:** An agent that forgets to write the tag, or writes it incorrectly, will cause a spurious interpretation pass rather than silently dropping work. This is a fail-open design: correctness of the tag is required for suppression, so omission errs toward doing more rather than less.

## Write Lock (Exclusive Access)

**Problem solved:** Two agent writes overlapping could produce a corrupt file or race condition in the watcher.

**Approach:** Before writing any file, an agent must acquire an exclusive lock represented by the file `agent-writing.lock`. The lock file stores the writing agent's process ID (PID). Only one agent write proceeds at a time; other agents queue with a 10-second timeout.

Stale lock recovery is built in: if the lock file exists but the recorded PID is no longer running, the lock is treated as dead and can be claimed by the waiting agent. The lock is released immediately after the file write completes — it is held for the minimum possible duration.

Both chat agents and execution agents share this single lock, so their writes are fully serialised regardless of origin.

**Inputs:** Lock file presence and PID on disk; requesting agent's PID.

**Outputs:** Granted access or queued wait (up to 10s) before timeout error.

**Key parameters:**
- Timeout: 10 seconds
- Lock file: `agent-writing.lock` (path relative to wiki root)
- Stale detection: PID liveness check via OS process table

**Trade-off:** Serialisation reduces write throughput when multiple agents are active concurrently. The 10-second timeout bounds the worst-case wait but means a genuinely slow write could starve a queued agent.

## Directory Separation

**Problem solved:** Agent-generated internal files (plans, intermediate outputs) would trigger the watcher if written to watched directories.

**Approach:** The watcher is configured to monitor only `/wiki/pages/` and `/wiki/meta/` — the directories that hold user-facing content. Agent output goes to `/wiki/.meta/` (a hidden directory), which is outside the watcher's scope.

One deliberate exception: writes to `meta/inbox.md` are watched, because that file is used for plan approval detection — a user action, not an agent loop risk.

**Inputs:** File write destination path.

**Outputs:** Watcher event fired (watched path) or silently ignored (hidden path).

**Trade-off:** The separation requires agents to be disciplined about output paths. A bug that writes to `/wiki/pages/` instead of `/wiki/.meta/` will immediately surface as a watcher event, making the error visible but potentially noisy.

## How the Three Mechanisms Interact

The mechanisms form a layered defence:

1. **Directory separation** prevents most agent-internal files from ever reaching the watcher.
2. **Frontmatter tag** catches the remaining case where an agent legitimately writes to a watched directory (e.g. publishing a finished wiki page).
3. **Write lock** ensures that even when multiple agents are active, writes are serialised and the tag is always written atomically before the lock is released.

Together, they mean that a correctly implemented agent can write freely without triggering cascading interpretation, while the watcher continues to respond normally to genuine user edits.

## Related

- [[skills]] — the agents that perform writes and must respect these mechanisms
- [[bootstrapping]] — the batch import process that performs many agent writes in sequence
