---
title: File Watcher Debounce
category: pipeline
tags: [file-watcher, debounce, sse, performance, pipeline]
summary: "The dual-stage debounce pipeline that sits between raw filesystem events and downstream reactions, batching rapid edits to deliver fast browser feedback while keeping AI summarisation costs low."
last-modified-by: agent
---

## Overview

Whenever a file changes under `wiki/pages/` or `wiki/meta/`, OctoWiki must decide what to do and when. A single user edit can emit dozens of OS-level filesystem events; text editors such as vim and VS Code add their own bursts of stat changes. Without debouncing, downstream reactions — SSE pushes, Haiku summarisation, backlink updates — would fire 3–5× per actual edit, wasting API calls and degrading performance.

The solution is a two-stage debounce pipeline that separates fast browser feedback from more expensive AI work.

## Trigger Conditions

- Any file change event (`fs.watch`) under `wiki/pages/` or `wiki/meta/`
- Events from both user edits and system writes are captured
- Chat agent writes bypass both stages and push SSE directly, ensuring immediate response to user chat interactions

## Stage 1: Browser Update (2 seconds)

**Input:** First (or any) file change event within a burst  
**Action:** Wait 2 seconds of inactivity, then push an SSE notification to all connected browsers  
**Output:** Browser re-renders the affected page

This stage batches rapid file changes — such as multiple saves during a single edit session — into a single notification. The 2-second window is short enough that users perceive changes as nearly instant.

## Stage 2: AI Summarisation (30 seconds idle)

**Input:** Settled burst of file changes (no new events for 30 seconds)  
**Action:** Run a Haiku interpretation pass over the changed pages  
**Output:** Updated summary, backlinks, tag suggestions, and change log entry

The 30-second idle threshold means Haiku runs once per edit burst, not on every keystroke. This keeps Claude API costs proportional to the number of distinct editing sessions rather than the number of individual saves.

## Dual-Timer Implementation

The `FileWatcher` class maintains two independent timers and a change queue:

```typescript
class FileWatcher {
  private changeQueue = new Set<string>();  // Pending slugs
  private immediateTimer: Timer | null = null;
  private batchTimer: Timer | null = null;
  private lastTrigger = 0;

  onChange(filePath: string) {
    const slug = pathToSlug(filePath);
    this.changeQueue.add(slug);

    // First change after a quiet period → immediate reaction
    if (Date.now() - this.lastTrigger > 500) {
      this.triggerImmediate();
      this.lastTrigger = Date.now();
    }

    // Batch window resets on every new change
    clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this.triggerBatch();
    }, 2000);
  }

  private async triggerImmediate() {
    const [slug] = this.changeQueue;
    await haikuSummaryAgent.process(slug);
    this.changeQueue.delete(slug);
  }

  private async triggerBatch() {
    const slugs = Array.from(this.changeQueue);
    await planningAgent.process(slugs);
    this.changeQueue.clear();
  }
}
```

## Timing Example

```
T=0ms     User edits page-a
            → Immediate: Haiku summarises page-a
            → Batch window opens (expires at T=2000ms)

T=150ms   User edits page-b
            → Added to queue
            → Batch window resets (expires at T=2150ms)

T=1800ms  User edits page-c
            → Added to queue
            → Batch window resets (expires at T=3800ms)

T=3800ms  No further edits
            → Batch fires: Planning Agent processes page-b and page-c together
```

## Error Handling

- If the immediate Haiku call fails, the slug remains in the queue and will be picked up by the batch pass
- A lock prevents races between the immediate and batch levels
- If the batch pass fails, the change queue is not cleared; the next file event will trigger a retry

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Browser feedback latency | ~2 seconds after last save |
| AI summarisation latency | ~30 seconds after editing stops |
| Immediate reaction cooldown | 500 ms (prevents spam) |
| Batch window | 2000 ms (resets on each change) |

These values are configurable per deployment.

## Dependencies

- Monitors `wiki/pages/` and `wiki/meta/` directories via `fs.watch`
- Pushes notifications to browsers over SSE (see [[sidebar-tree-navigation]] for how the browser responds)
- Calls Haiku for per-page summarisation
- Calls Planning Agent for cross-page batch analysis
