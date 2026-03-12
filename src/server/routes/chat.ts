import { Hono } from "hono";
import type { AppContext } from "../app";
import { readPage } from "../../wiki/pages";
import { writePage } from "../../wiki/pages";
import { parseFrontmatter } from "../../wiki/frontmatter";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { sseEmitter } from "../sse";
import { chatWithPage } from "../../agents/haiku";
import { withLock } from "../../wiki/lock";
import type { PageMeta, ChatExchange } from "../../types";

export function chatRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const pagesDir = join(ctx.wikiDir, "pages");
  const metaPagesDir = join(ctx.wikiDir, ".meta/pages");

  const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]*$/;

  router.post("/chat/:page", async (c) => {
    const slug = c.req.param("page");
    if (!SAFE_SLUG.test(slug)) return c.json({ error: "Invalid slug" }, 400);
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
    const recentHistory = meta.history.slice(-10);

    const lockPath = join(ctx.wikiDir, ".meta/agent-writing.lock");

    try {
      const result = await withLock(lockPath, async () => {
        const { updatedContent, agentMessage } = await chatWithPage({
          page,
          message: body.message,
          history: recentHistory.map((h) => ({ role: h.role, message: h.message })),
        });

        // Write updated page with agent attribution
        const rawPage = readFileSync(join(pagesDir, `${slug}.md`), "utf-8");
        const { data } = parseFrontmatter(rawPage);
        writePage(pagesDir, slug, { ...data, "last-modified-by": "agent" }, updatedContent);

        return { updatedContent, agentMessage };
      });

      const exchange: ChatExchange = {
        timestamp: new Date().toISOString(),
        role: "agent",
        message: result.agentMessage,
        pageDiff: result.updatedContent,
      };

      // Append to history
      meta.history.push(
        { timestamp: new Date().toISOString(), role: "user", message: body.message },
        exchange
      );
      mkdirSync(metaPagesDir, { recursive: true });
      writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      // Push SSE directly (no debounce for chat)
      sseEmitter.emit({ type: "page-changed", slug });

      return c.json({ exchange });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Chat failed" }, 500);
    }
  });

  return router;
}
