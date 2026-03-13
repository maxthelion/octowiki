---
title: Chat-in-Page
category: ui
tags: [chat, interaction, editing, real-time, ai]
summary: "Each wiki page embeds a chat box at the bottom that lets users ask questions or request edits, with Claude responding by directly modifying the page content in real time."
last-modified-by: agent
---

## Overview

Chat-in-page is a lightweight interaction model where every wiki page carries an embedded chat box fixed at the bottom of the view. Messages sent from this box are scoped to the page: the agent receives the full page content as context and responds either with an answer in the chat or by editing the page directly. There is no separate chat transcript UI — the conversation materialises as changes to the document itself.

## Visual Structure

```
┌──────────────────────────────────────────────┐
│  Page content (rendered markdown)            │
│                                              │
│  ...                                         │
│                                              │
├──────────────────────────────────────────────┤
│  [Chat history — last N exchanges]           │
├──────────────────────────────────────────────┤
│  Ask about this page...         [Send]       │
└──────────────────────────────────────────────┘
```

The send button is disabled while a request is in flight. The chat history area above the input shows prior exchanges for context.

## Component Structure

The chat box is a `<ChatBox slug={slug} />` component with the following internal shape:

```tsx
<ChatBox slug={slug} />
  └─ useState(message)       // Input text
  └─ useSendChat(slug)       // POST mutation
  └─ handleSubmit()          // POST and refetch
  └─ <input> + <button>
```

On submit the component POSTs to `/api/chat/:slug`, then calls the page refetch hook so any agent-authored edits appear immediately.

## Request / Response Flow

```
User types message → clicks Send
  → POST /api/chat/:slug
      { message: "..." }
    → Agent receives:
        - Page content (slug, title, tags, markdown)
        - Chat history from .meta/pages/<slug>-chat.json (last 10 exchanges)
        - User message
    → Agent responds and optionally edits the page on disk
    → Exchange appended to .meta/pages/<slug>-chat.json
  → File watcher detects page change
    → SSE push to browser
      → Page re-renders with new content
      → Chat box shows agent response
      → Input clears
```

The agent used is Claude (Sonnet for the full conversation; Haiku is used for history compression). Requests time out after 10 seconds; errors are surfaced inline in the chat area.

## Interaction Patterns

### Ask a Question

The agent answers in the chat area without touching the page:

```
User:  "Can you explain the algorithm used here?"
Agent: "This uses three phases: discovery, grouping, synthesis. First..."
```

### Request an Edit

The agent edits the page directly and the browser updates via SSE:

```
User:  "Can you add a usage example?"
Agent: "Sure — I've added a code block under the Usage section."
// Page content is updated; browser re-renders automatically
```

### Explore Connections

The agent can reason about backlinks and related pages:

```
User:  "What pages reference this one?"
Agent: "This is referenced by [[page-a]] and [[page-b]]..."
```

## Chat History Storage

History is stored as a JSON array in `wiki/.meta/pages/<slug>-chat.json`. Each entry carries a timestamp, role (`user` or `agent`), the message text, and — for agent turns — a diff of what was changed:

```json
{
  "page": "road-network.md",
  "history": [
    {
      "timestamp": "2026-03-12T14:00:00Z",
      "role": "user",
      "message": "Add constraints for water boundaries"
    },
    {
      "timestamp": "2026-03-12T14:00:03Z",
      "role": "agent",
      "message": "Updated constraints section.",
      "page_diff": "..."
    }
  ]
}
```

Only the last 10 exchanges are sent to the agent on each request. Older history is periodically summarised and compressed by Haiku to keep the context window manageable without losing conversational continuity.

## States

| State | Behaviour |
|---|---|
| Idle | Input active, send button enabled |
| Pending | Send button disabled, spinner shown |
| Success (no page edit) | Agent reply appears in chat; input clears |
| Success (page edited) | Agent reply appears; page re-renders via SSE |
| Error | Error message shown inline; input remains for retry |

## Related

- [[agent-activity-indicator]] — visual indicator shown while the agent is processing a request
- [[sidebar-tree-navigation]] — the broader page navigation context in which the chat box operates
