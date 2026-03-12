---
title: Agent Activity Indicator
category: ui
tags: [agents, feedback, status, chat, ux]
summary: Show users when agents are working and display their responses, via a status indicator in the top menu bar.
last-modified-by: user
---

## Problem

When a user sends a chat message, there's no visible feedback about what's happening. The API call to the agent can take several seconds. If it fails (e.g. missing API key), the message silently disappears. The user has no idea if something is working or broken.

## Design

### Top Bar Status Indicator

Add a persistent status area in the top of the main content panel (or a thin bar above the page content) that shows agent activity:

```
┌─────────────────────────────────────────────┐
│  ● Agent working on "issues-with-v1"...     │
├─────────────────────────────────────────────┤
│  Page content...                            │
```

States:

| State | Display |
|-------|---------|
| Idle | Nothing shown (bar hidden or minimal) |
| Chat pending | Pulsing dot + "Agent thinking..." |
| Chat complete | Brief flash: "Page updated" (auto-dismiss after 3s) |
| Chat failed | Red: "Agent error: {message}" (stays until dismissed) |
| Haiku processing | Subtle: "Indexing changes..." |
| Plan executing | "Executing plan: {title}..." |

### Chat Box Feedback

The [[sidebar-tree-navigation]] ChatBox should also show inline feedback:

- **While sending**: Input disabled, button shows spinner/dots (already partially implemented)
- **On success**: Show the agent's `agentMessage` response below the input briefly
- **On error**: Show error message in red below the input, keep the user's message so they can retry

### Agent Message Display

When the agent responds to a chat message, it returns an `agentMessage` explaining what it changed. This should be shown to the user — currently it's returned by the API but never displayed.

Options:
1. **Toast notification** — brief overlay in bottom-right
2. **Inline below chat input** — shows the last agent response
3. **Chat history panel** — expandable panel showing the conversation (already stored in `.meta/pages/<slug>.json`)

Recommendation: Start with option 2 (inline below chat input) — simplest, most visible. Add option 3 later when the chat history is more fleshed out.

### SSE-Driven Updates

The existing SSE system already pushes `page-changed`, `feed-updated`, and `plan-status-changed` events. The activity indicator should listen to these:

- `page-changed` after a chat → "Page updated"
- `plan-status-changed` → "Plan {id}: {status}"
- `feed-updated` → "New changes indexed" (subtle, low priority)

## Implementation Notes

- The status bar component should subscribe to a simple state store (React context or zustand) that agent-calling hooks write to
- Chat mutations in [[issues-with-v1]] `usePages.ts` already have `onSuccess` and `onError` — wire these to the status store
- Error display is the highest priority — silent failures are the worst UX
- The Haiku watcher status can come from SSE events since the watcher runs server-side

## Related

- [[issues-with-v1]] — tracks the silent error swallowing issue
- [[sidebar-tree-navigation]] — ChatBox component that triggers agent calls
- [[design-spec]] — SSE event types defined in Section 6
