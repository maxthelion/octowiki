import { Hono } from "hono";
import type { AppContext } from "../app";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { Plan } from "../../types";
import { sseEmitter } from "../sse";

export function inboxRouter(ctx: AppContext): Hono {
  const router = new Hono();
  const plansDir = join(ctx.wikiDir, ".meta/plans");

  router.get("/inbox", (c) => {
    if (!existsSync(plansDir)) return c.json([]);

    const plans: Plan[] = readdirSync(plansDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(plansDir, f), "utf-8")));

    return c.json(plans);
  });

  router.post("/inbox/:planId/approve", async (c) => {
    const planId = c.req.param("planId");
    const planPath = join(plansDir, `${planId}.json`);

    if (!existsSync(planPath)) {
      return c.json({ error: "Plan not found" }, 404);
    }

    const plan: Plan = JSON.parse(readFileSync(planPath, "utf-8"));
    plan.status = "approved";
    writeFileSync(planPath, JSON.stringify(plan, null, 2));

    sseEmitter.emit({ type: "plan-status-changed", planId });

    return c.json({ status: "approved" });
  });

  router.post("/inbox/:planId/reject", async (c) => {
    const planId = c.req.param("planId");
    const planPath = join(plansDir, `${planId}.json`);

    if (!existsSync(planPath)) {
      return c.json({ error: "Plan not found" }, 404);
    }

    const plan: Plan = JSON.parse(readFileSync(planPath, "utf-8"));
    plan.status = "rejected";
    writeFileSync(planPath, JSON.stringify(plan, null, 2));

    sseEmitter.emit({ type: "plan-status-changed", planId });

    return c.json({ status: "rejected" });
  });

  return router;
}
