import { callAgent } from "./client";
import type { Plan } from "../types";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { sseEmitter } from "../server/sse";

const EXECUTOR_MODEL = "claude-sonnet-4-6";

function resolveTarget(target: string, wikiDir: string): string {
  if (!target.includes("/") && !target.includes(".")) {
    return join(wikiDir, "pages", `${target}.md`);
  }
  return target;
}

export async function executePlan(plan: Plan, wikiDir: string): Promise<void> {
  const planPath = join(wikiDir, ".meta/plans", `${plan.id}.json`);

  try {
    const branchName = `octowiki/${plan.id}`;
    const branchResult = Bun.spawnSync(["git", "checkout", "-b", branchName]);
    if (branchResult.exitCode !== 0) {
      throw new Error(`Failed to create branch: ${branchResult.stderr.toString()}`);
    }

    for (const step of plan.steps) {
      const targetPath = resolveTarget(step.target, wikiDir);

      const response = await callAgent({
        model: EXECUTOR_MODEL,
        maxTokens: 8192,
        system: `You are an execution agent. Implement the requested change. Respond with JSON:\n- "content": the full file content to write\n- "commitMessage": a short commit message`,
        messages: [
          {
            role: "user",
            content: `Action: ${step.action}\nTarget: ${step.target}\nDescription: ${step.description}${step.action !== "create" && existsSync(targetPath) ? `\n\nCurrent content:\n${readFileSync(targetPath, "utf-8")}` : ""}`,
          },
        ],
      });

      let parsed: { content?: string; commitMessage?: string };
      try {
        parsed = JSON.parse(response);
      } catch {
        throw new Error(`Agent returned invalid JSON for step: ${step.description}`);
      }

      if (step.action === "delete") {
        if (existsSync(targetPath)) unlinkSync(targetPath);
      } else {
        writeFileSync(targetPath, parsed.content ?? "");
      }

      Bun.spawnSync(["git", "add", "-A"]);
      Bun.spawnSync(["git", "commit", "-m", parsed.commitMessage ?? step.description]);
    }

    plan.status = "done";
    writeFileSync(planPath, JSON.stringify(plan, null, 2));
    Bun.spawnSync(["git", "checkout", "-"]);
    updateInboxStatus(wikiDir, plan.id, "done");
    sseEmitter.emit({ type: "plan-status-changed", planId: plan.id });
  } catch (error) {
    plan.status = "failed";
    plan.error = error instanceof Error ? error.message : String(error);
    writeFileSync(planPath, JSON.stringify(plan, null, 2));
    Bun.spawnSync(["git", "checkout", "-"]);
    updateInboxStatus(wikiDir, plan.id, "failed", plan.error);
    sseEmitter.emit({ type: "plan-status-changed", planId: plan.id });
  }
}

function updateInboxStatus(wikiDir: string, planId: string, status: string, error?: string): void {
  const inboxPath = join(wikiDir, "meta/inbox.md");
  if (!existsSync(inboxPath)) return;
  let content = readFileSync(inboxPath, "utf-8");
  content = content.replace(
    new RegExp(`(## ${planId}[^\n]*\n)\\*Status: \\w+\\*`),
    `$1*Status: ${status}*${error ? `\n\n**Error:** ${error}` : ""}`
  );
  writeFileSync(inboxPath, content);
}
