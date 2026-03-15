import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { detectSkills } from "./setup";

function templatesDir(): string {
  return join(import.meta.dir, "templates");
}

export function initWiki(projectRoot: string): void {
  const wikiDir = join(projectRoot, "wiki");

  for (const dir of ["pages", ".meta/pages", ".meta/plans"]) {
    mkdirSync(join(wikiDir, dir), { recursive: true });
  }

  const taxonomyDest = join(wikiDir, "pages/category-taxonomy.md");
  if (!existsSync(taxonomyDest)) {
    const taxonomySrc = join(templatesDir(), "category-taxonomy.md");
    writeFileSync(taxonomyDest, readFileSync(taxonomySrc, "utf-8"));
  }

  const queuePath = join(wikiDir, ".meta/queue.json");
  if (!existsSync(queuePath)) {
    writeFileSync(queuePath, "[]");
  }
  const backlinksPath = join(wikiDir, ".meta/backlinks.json");
  if (!existsSync(backlinksPath)) {
    writeFileSync(backlinksPath, "{}");
  }

  const claudeMdPath = join(projectRoot, "CLAUDE.md");
  const snippet = readFileSync(join(templatesDir(), "claude-md-snippet.md"), "utf-8");

  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, "utf-8");
    if (!existing.includes("<!-- octowiki -->")) {
      appendFileSync(claudeMdPath, "\n" + snippet);
    }
  } else {
    writeFileSync(claudeMdPath, snippet);
  }
}

export async function run(args: string[], flags: Record<string, string | boolean>): Promise<void> {
  const projectRoot = process.cwd();

  const globalDir = join(homedir(), ".claude", "skills");
  const localDir = join(projectRoot, ".claude", "skills");
  const skillsLocation = detectSkills(globalDir, localDir);

  if (!skillsLocation) {
    console.error("Skills not installed. Run `octowiki setup` first.");
    process.exit(1);
  }

  initWiki(projectRoot);

  console.log("Wiki initialized:");
  console.log("  wiki/pages/            — wiki pages");
  console.log("  wiki/.meta/            — agent metadata");
  console.log("  CLAUDE.md              — updated with wiki instructions");
  console.log("\nNext: run `octowiki import .` to bootstrap from existing docs.");
}
