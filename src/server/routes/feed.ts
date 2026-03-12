import { Hono } from "hono";
import type { AppContext } from "../app";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ChangeSummary } from "../../types";

export function feedRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const queuePath = join(ctx.wikiDir, ".meta/queue.json");

  router.get("/feed", (c) => {
    if (!existsSync(queuePath)) return c.json([]);
    const queue: ChangeSummary[] = JSON.parse(readFileSync(queuePath, "utf-8"));
    return c.json([...queue].reverse());
  });

  return router;
}
