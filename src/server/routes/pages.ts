import { Hono } from "hono";
import type { AppContext } from "../app";
import { readPage, listPages, writePage } from "../../wiki/pages";
import { join } from "path";

export function pagesRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const pagesDir = join(ctx.wikiDir, "pages");

  router.get("/pages", (c) => {
    const pages = listPages(pagesDir);
    const summaries = pages.map(({ content, ...rest }) => rest);
    return c.json(summaries);
  });

  router.get("/pages/:slug", (c) => {
    const slug = c.req.param("slug");
    const page = readPage(pagesDir, slug);
    if (!page) return c.json({ error: "Page not found" }, 404);
    return c.json(page);
  });

  router.post("/pages", async (c) => {
    const body = await c.req.json<{
      notes: string;
      category?: string;
      relatedPages?: string[];
    }>();

    const slug = body.notes
      .split("\n")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    const title = body.notes.split("\n")[0].replace(/^#\s*/, "");

    writePage(pagesDir, slug, {
      title,
      category: body.category ?? "",
      tags: [],
      summary: "",
      "last-modified-by": "user",
    }, `## Notes\n\n${body.notes}`);

    return c.json({ slug }, 201);
  });

  return router;
}
