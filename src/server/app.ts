import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { sseEmitter } from "./sse";
import { pagesRouter } from "./routes/pages";
import { feedRouter } from "./routes/feed";
import { inboxRouter } from "./routes/inbox";
import { searchRouter } from "./routes/search";
import { taxonomyRouter } from "./routes/taxonomy";
import { chatRouter } from "./routes/chat";
import { planRouter } from "./routes/plan";
import type { SSEEvent } from "../types";

export interface AppContext {
  wikiDir: string;
}

export function createApp(ctx: AppContext): Hono {
  const app = new Hono();

  // SSE endpoint
  app.get("/api/sse", (c) => {
    return streamSSE(c, async (stream) => {
      const unsubscribe = sseEmitter.subscribe((event: SSEEvent) => {
        stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      const keepAlive = setInterval(() => {
        stream.writeSSE({ event: "ping", data: "" });
      }, 30_000);

      stream.onAbort(() => {
        unsubscribe();
        clearInterval(keepAlive);
      });

      await new Promise(() => {});
    });
  });

  // Mount route modules
  app.route("/api", pagesRouter(ctx));
  app.route("/api", feedRouter(ctx));
  app.route("/api", inboxRouter(ctx));
  app.route("/api", searchRouter(ctx));
  app.route("/api", taxonomyRouter(ctx));
  app.route("/api", chatRouter(ctx));
  app.route("/api", planRouter(ctx));

  return app;
}
