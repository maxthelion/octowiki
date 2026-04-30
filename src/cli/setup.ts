import { existsSync, mkdirSync, cpSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SKILL_NAMES = ["octowiki-add-page", "octowiki-batch-import", "octowiki-invariants"];

function bundledSkillsDir(): string {
  return join(import.meta.dir, "..", "..", "bundle", "skills");
}

export function detectSkills(globalDir: string, localDir: string): "global" | "local" | null {
  const checkDir = (dir: string) =>
    SKILL_NAMES.some((name) => existsSync(join(dir, name, "SKILL.md")));

  if (checkDir(globalDir)) return "global";
  if (checkDir(localDir)) return "local";
  return null;
}

export function copySkills(targetDir: string): void {
  const srcDir = bundledSkillsDir();
  for (const name of SKILL_NAMES) {
    const dest = join(targetDir, name);
    mkdirSync(dest, { recursive: true });
    cpSync(join(srcDir, name), dest, { recursive: true });
  }
}

export async function run(args: string[], flags: Record<string, string | boolean>): Promise<void> {
  const globalDir = join(homedir(), ".claude", "skills");
  const localDir = join(process.cwd(), ".claude", "skills");

  const existing = detectSkills(globalDir, localDir);

  if (existing) {
    const location = existing === "global" ? globalDir : localDir;
    console.log(`Skills already installed (${existing}): ${location}`);

    if (!flags.global && !flags.local) {
      process.stdout.write("Reinstall? [y/N] ");
      const answer = (await readLine()).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        console.log("Skipped.");
        return;
      }
    }
  }

  let target: "global" | "local";
  if (flags.global) {
    target = "global";
  } else if (flags.local) {
    target = "local";
  } else {
    console.log("Where should OctoWiki skills be installed?\n");
    console.log(`  1. Global  (~/.claude/skills/) — available in all projects`);
    console.log(`  2. Local   (.claude/skills/)   — only this project\n`);
    process.stdout.write("Choice [1/2]: ");
    const answer = (await readLine()).trim();
    target = answer === "2" ? "local" : "global";
  }

  const targetDir = target === "global" ? globalDir : localDir;
  copySkills(targetDir);
  console.log(`\nSkills installed to ${targetDir}`);
  console.log("  octowiki-add-page");
  console.log("  octowiki-batch-import");
  console.log("  octowiki-invariants");
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
      if (data.includes("\n")) {
        process.stdin.pause();
        resolve(data);
      }
    });
    process.stdin.resume();
  });
}
