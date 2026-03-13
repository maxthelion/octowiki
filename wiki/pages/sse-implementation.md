---
title: Server-Sent Events (SSE) Implementation
category: pipeline
tags: [sse, real-time, pipeline, api]
summary: "How OctoWiki uses a single SSE endpoint to push real-time update notifications from server to browser clients, triggering selective UI re-fetches without polling."
last-modified-by: agent
---

## Overview

OctoWiki uses Server-Sent Events (SSE) to deliver real-time update notifications from the server to connected browser clients. Rather than polling or using full bidirectional WebSockets, SSE provides a lightweight, unidirectional push channel that keeps the UI in sync with server-side state changes — page edits, new feed entries, and plan status transitions — as they happen.

The entire SSE surface is a single endpoint: `GET /api/sse`. All event types flow through this one connection.

## Trigger Conditions

SSE events are emitted after the agent pipeline has reacted to a state change. The general data flow is:

```
User Action (page edit, chat message, plan approval)
  ↓
HTTP Request to API route
  ↓
Modify pages/state on disk
  ↓
File watcher detects change
  ↓
Agent pipeline reacts
  ↓
SSE event sent to all clients
  ↓
Clients receive update, refetch data
  ↓
UI re-renders
```

SSE events are therefore downstream of the file watcher and agent pipeline — they signal completion, not initiation.

## Event Types

Three event types are defined:

| Event | Trigger |
|---|---|
| `page-changed` | A wiki page's content was updated |
| `feed-updated` | A new change summary was appended to the feed |
| `plan-status-changed` | A plan in the inbox transitioned to a new status |

Each event payload includes the affected page slug or plan ID so that clients can re-fetch only the resource that changed, rather than refreshing the entire application state.

## Endpoint

The server registers a single SSE route with the appropriate streaming headers:

```typescript
// Server endpoint
app.get("/api/sse", (c) => {
  const response = new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
  // Write events to response body
  return response;
});
```

Clients subscribe once on page load and remain connected for the lifetime of the browser session.

## Debounce Behaviour

To prevent browser flicker when files change rapidly (for example, during an agent write burst), SSE notifications are debounced:

- **File-watcher-triggered events:** 2-second debounce after the file change is detected before the SSE event is emitted.
- **Chat-triggered writes:** Bypass the debounce and emit immediately, since the user is waiting for a direct response.

This means the UI stays responsive to user-initiated actions while avoiding unnecessary re-renders during batch agent operations.

## Connection Management

- The browser's native `EventSource` API handles automatic reconnection if the SSE connection drops.
- Graceful degradation is applied if SSE is unavailable — the UI falls back to a non-live state rather than breaking.
- Updates across UI components are serialised through the single connection, preventing race conditions between concurrent state updates.

## Error Handling

SSE is a one-way channel; errors in processing are not surfaced back through the SSE stream. If an agent pipeline step fails, no `page-changed` event is emitted — the client simply does not receive an update for that change. Observability for pipeline failures is handled separately.

## Dependencies

- **File watcher** — detects on-disk changes and initiates the pipeline that eventually emits SSE events.
- **Agent pipeline** — processes changes before the SSE notification is sent; SSE is the terminal step of the pipeline.
- **API routes** — other endpoints (`/api/pages`, `/api/feed`, `/api/inbox`) are the targets clients call after receiving an SSE event; see the plans documentation for full API route definitions.
