---
title: Frontend Routing and Layout
category: ui
tags: [frontend, routing, react, spa, state-management]
summary: "Describes the OctoWiki single-page application's route structure, persistent UI layout, and real-time data synchronisation via React Query and Server-Sent Events."
last-modified-by: agent
---

## Overview

The OctoWiki frontend is a React 18 single-page application built with React Router for navigation, React Query (TanStack Query) for server state, and a layout where certain UI elements — the sidebar and chat box — persist across all routes. Real-time updates arrive via Server-Sent Events (SSE) and trigger automatic data re-fetches without full page reloads.

## Routes

| Path | Component | Purpose |
|------|-----------|--------|
| `/` | — | Redirects to `/feed` |
| `/page/:slug` | `PageView` | Renders a wiki page with its `ChatBox` |
| `/feed` | `ChangesFeed` | Shows recent changes; also accessible as a sidebar overlay |
| `/inbox` | `Inbox` | Lists plans in pending / approved / done states |
| `/search?q=...` | `Search` | Displays search results |

All routes share the persistent `PageList` sidebar and the fixed `ChatBox` at the bottom of the viewport.

## Persistent Layout

Two UI elements are always present regardless of the active route:

**PageList sidebar** — a 250 px fixed-width panel on the left that lists all pages grouped by category, highlights the current page, and provides quick links to `/feed` and `/inbox`. It includes an "+ Add Page" button.

**ChatBox** — fixed to the bottom of the viewport on `/page/:slug` routes. It sends a user message via `POST /api/chat/:slug` and triggers a page refetch on response. The send button is disabled while a request is in flight.

On other routes (feed, inbox, search) the ChatBox is not rendered because there is no current page context.

## Core Components

### PageView

Displays a single wiki page. Contains a header with title, category, and tags; rendered markdown content including wikilink resolution (see [[sidebar-tree-navigation]] for how wikilinks are surfaced in navigation); and the `ChatBox` anchored below.

### ChangesFeed

Lists recent change events. Rows have multi-select checkboxes; when one or more are selected a "Plan this (N)" button appears to batch the selected changes into a plan. Each row links to the affected page.

### Inbox

Lists plans with status badges (pending / approved / done / error). Pending plans show Approve and Reject buttons. Error state surfaces the plan's error message.

### HoverSummary

Shown when hovering an internal wikilink — provides an inline preview of the linked page without navigation.

### SourceBlock

An expandable block that reveals the source reference behind a rendered content section.

## Project Structure

```
web/
  src/
    components/
      PageList.tsx
      PageView.tsx
      ChatBox.tsx
      ChangesFeed.tsx
      Inbox.tsx
      Search.tsx
      HoverSummary.tsx
      SourceBlock.tsx
    hooks/
      useSSE.ts
      usePages.ts
    lib/
      markdown.ts
    App.tsx
    index.tsx
    index.css
  index.html
  vite.config.ts
```

`App.tsx` is the root component that mounts React Router and the `useSSE` hook. `lib/markdown.ts` contains the markdown renderer with wikilink support.

## State Management

Server state is managed exclusively via React Query:

```typescript
usePageList()      // GET /api/pages
usePage(slug)      // GET /api/pages/:slug
useFeed()          // GET /api/feed
useInbox()         // GET /api/inbox
useSendChat(slug)  // POST /api/chat/:slug
useCreatePlan()    // POST /api/plan
useApprovePlan()   // POST /api/inbox/:id/approve
useRejectPlan()    // POST /api/inbox/:id/reject
useCreatePage()    // POST /api/pages
```

Local component state (form inputs, toggle open/closed, hover visibility) is managed with standard React `useState`.

## Real-time Updates

The `useSSE` hook is mounted once in `App.tsx` and listens to a Server-Sent Events stream. When events arrive it calls `queryClient.invalidateQueries` on the relevant query key, causing React Query to re-fetch automatically:

| SSE event | Invalidated query key |
|-----------|----------------------|
| `page-changed` | `["page", slug]` |
| `feed-updated` | `["feed"]` |
| `plan-status-changed` | `["inbox"]` |

This means users see page edits, new feed entries, and plan status transitions appear in the UI without manual refresh.

## States

Each data-dependent component handles the standard React Query states:

- **Loading** — skeleton or spinner shown while the initial fetch is in flight
- **Error** — inline error message with the HTTP status or network error detail
- **Empty** — zero-item empty state (e.g. no pages, no feed entries)
- **Populated** — normal rendered content

## Styling

Components use CSS-in-JS via inline styles. Global styles and resets live in `index.css`.

## Related

- [[sidebar-tree-navigation]] — how the PageList sidebar organises and presents pages
- [[agent-activity-indicator]] — real-time indicator of background agent activity surfaced in the UI
