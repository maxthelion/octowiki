import { Hono } from "hono";
import type { AppContext } from "../app";
import { search } from "../../search/qmd";
import { join } from "path";

export function searchRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const indexDir = join(ctx.wikiDir, ".index");

  router.get("/search", async (c) => {
    const query = c.req.query("q");
    const mode = (c.req.query("mode") ?? "search") as "search" | "vsearch" | "query";

    if (!query) return c.json({ error: "Missing query parameter 'q'" }, 400);

    const results = await search(indexDir, query, mode);
    return c.json(results);
  });

  return router;
}
