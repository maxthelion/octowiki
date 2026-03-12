import { Hono } from "hono";
import type { AppContext } from "../app";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ChangeSummary } from "../../types";

export function planRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const queuePath = join(ctx.wikiDir, ".meta/queue.json");

  router.post("/plan", async (c) => {
    const body = await c.req.json<{ changeIds: string[] }>();

    if (!body.changeIds?.length) {
      return c.json({ error: "No change IDs provided" }, 400);
    }

    if (!existsSync(queuePath)) {
      return c.json({ error: "No changes in queue" }, 404);
    }

    const queue: ChangeSummary[] = JSON.parse(readFileSync(queuePath, "utf-8"));
    const selected = queue.filter((item) => body.changeIds.includes(item.id));

    if (selected.length === 0) {
      return c.json({ error: "No matching changes found" }, 404);
    }

    // Stub — real agent wired in Task 11
    return c.json({ status: "planning", selectedCount: selected.length });
  });

  return router;
}
