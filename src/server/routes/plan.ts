import { Hono } from "hono";
import type { AppContext } from "../app";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ChangeSummary } from "../../types";
import { createPlan } from "../../agents/planner";
import { listPages, readPage } from "../../wiki/pages";
import { loadBacklinks } from "../../wiki/backlinks";
import { sseEmitter } from "../sse";

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

    try {
      const pagesDir = join(ctx.wikiDir, "pages");
      const allPages = listPages(pagesDir);
      const pageSummaries = allPages.map((p) => ({
        slug: p.slug, title: p.title, summary: p.summary, tags: p.tags,
      }));
      const backlinks = loadBacklinks(join(ctx.wikiDir, ".meta/backlinks.json"));
      const taxonomyPath = join(ctx.wikiDir, "meta/taxonomy.md");
      const taxonomyContent = existsSync(taxonomyPath) ? readFileSync(taxonomyPath, "utf-8") : "";

      const plan = await createPlan({
        changes: selected,
        pageSummaries,
        backlinks,
        taxonomyContent,
        wikiDir: ctx.wikiDir,
        getPageContent: (slug) => readPage(pagesDir, slug)?.content ?? null,
      });

      sseEmitter.emit({ type: "plan-status-changed", planId: plan.id });

      return c.json(plan, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Planning failed" }, 500);
    }
  });

  return router;
}
