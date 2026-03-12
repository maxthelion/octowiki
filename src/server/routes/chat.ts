import { Hono } from "hono";
import type { AppContext } from "../app";
import { readPage } from "../../wiki/pages";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { sseEmitter } from "../sse";
import type { PageMeta, ChatExchange } from "../../types";

export function chatRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const pagesDir = join(ctx.wikiDir, "pages");
  const metaPagesDir = join(ctx.wikiDir, ".meta/pages");

  router.post("/chat/:page", async (c) => {
    const slug = c.req.param("page");
    const page = readPage(pagesDir, slug);
    if (!page) return c.json({ error: "Page not found" }, 404);

    const body = await c.req.json<{ message: string }>();
    if (!body.message) return c.json({ error: "Missing message" }, 400);

    // Load chat history (last 10)
    const metaPath = join(metaPagesDir, `${slug}.json`);
    let meta: PageMeta = { page: slug, history: [] };
    if (existsSync(metaPath)) {
      meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    }

    // Stub response — real agent wired in Task 10
    const exchange: ChatExchange = {
      timestamp: new Date().toISOString(),
      role: "agent",
      message: "Chat agent not yet connected.",
    };

    meta.history.push(
      { timestamp: new Date().toISOString(), role: "user", message: body.message },
      exchange
    );
    mkdirSync(metaPagesDir, { recursive: true });
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    sseEmitter.emit({ type: "page-changed", slug });

    return c.json({ exchange });
  });

  return router;
}
