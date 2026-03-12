import { Hono } from "hono";
import type { AppContext } from "../app";
import { loadTaxonomy } from "../../wiki/taxonomy";
import { join } from "path";

export function taxonomyRouter(ctx: AppContext): Hono {
  const router = new Hono();

  router.get("/taxonomy", (c) => {
    const taxonomy = loadTaxonomy(join(ctx.wikiDir, "meta/taxonomy.md"));
    return c.json(taxonomy);
  });

  return router;
}
