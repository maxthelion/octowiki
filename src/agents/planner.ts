import { callAgent } from "./client";
import type { ChangeSummary, Plan, PlanStep } from "../types";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const PLANNER_MODEL = "claude-sonnet-4-6";

export async function createPlan(opts: {
  changes: ChangeSummary[];
  pageSummaries: { slug: string; title: string; summary: string; tags: string[] }[];
  backlinks: Record<string, string[]>;
  taxonomyContent: string;
  wikiDir: string;
  getPageContent: (slug: string) => string | null;
}): Promise<Plan> {
  const response = await callAgent({
    model: PLANNER_MODEL,
    maxTokens: 8192,
    system: `You are a planning agent for a wiki-driven development system. Given change summaries from the wiki, produce a structured plan for code and wiki updates.

Respond with JSON:
- "title": short plan title
- "summary": 2-3 sentence description
- "steps": array of { "description": string, "target": string (file path or page slug), "action": "create" | "update" | "delete" }

Be specific about what changes are needed and why.`,
    messages: [
      {
        role: "user",
        content: `## Change Summaries
${opts.changes.map((c) => `- [${c.page}] ${c.summary}`).join("\n")}

## All Page Summaries
${opts.pageSummaries.map((p) => `- ${p.slug} (${p.title}): ${p.summary} [tags: ${p.tags.join(", ")}]`).join("\n")}

## Backlinks
${JSON.stringify(opts.backlinks, null, 2)}

## Taxonomy
${opts.taxonomyContent}`,
      },
    ],
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { title: "Untitled plan", summary: response, steps: [] };
  }

  // Generate plan ID
  const today = new Date().toISOString().slice(0, 10);
  const plansDir = join(opts.wikiDir, ".meta/plans");
  mkdirSync(plansDir, { recursive: true });
  const existing = existsSync(plansDir)
    ? readdirSync(plansDir).filter((f) => f.startsWith(`plan-${today}`)).length
    : 0;
  const planId = `plan-${today}-${String(existing + 1).padStart(3, "0")}`;

  const plan: Plan = {
    id: planId,
    title: (parsed.title as string) ?? "Untitled plan",
    status: "pending",
    summary: (parsed.summary as string) ?? "",
    steps: ((parsed.steps as PlanStep[]) ?? []).map((s) => ({
      description: s.description,
      target: s.target,
      action: s.action,
    })),
  };

  // Save plan JSON
  writeFileSync(join(plansDir, `${planId}.json`), JSON.stringify(plan, null, 2));

  // Append to inbox.md
  const inboxPath = join(opts.wikiDir, "meta/inbox.md");
  let inbox = existsSync(inboxPath) ? readFileSync(inboxPath, "utf-8") : "# Inbox\n\n";
  inbox += `\n## ${planId} — ${plan.title}\n*Status: pending*\n\n${plan.summary}\n\n${plan.steps.map((s) => `- ${s.action} \`${s.target}\` — ${s.description}`).join("\n")}\n\n[Full plan details](.meta/plans/${planId}.json)\n`;
  writeFileSync(inboxPath, inbox);

  return plan;
}
