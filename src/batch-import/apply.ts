import {
  readdirSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  renameSync,
  writeFileSync,
  existsSync,
} from "fs";
import { join } from "path";
import type { NewPageReduceOutput, MergeReduceOutput } from "./types";

/**
 * Reads reduce output JSON files, constructs wiki pages with proper frontmatter,
 * and stages them using the backup-and-swap approach.
 *
 * Usage: bun run src/batch-import/apply.ts <reduce-dir> [--revert]
 *
 *   <reduce-dir>  Directory containing reduce output JSON files (*.json)
 *   --revert      Swap wiki/pages-pre-import back to wiki/pages
 */

function yamlValue(value: string): string {
  // Quote if value contains YAML-special characters
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.startsWith('"') || value.startsWith("'")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function buildFrontmatter(data: {
  title: string;
  category: string;
  tags: string[];
  summary: string;
}): string {
  return [
    "---",
    `title: ${yamlValue(data.title)}`,
    `category: ${data.category}`,
    `tags: [${data.tags.join(", ")}]`,
    `summary: ${yamlValue(data.summary)}`,
    "last-modified-by: agent",
    "---",
  ].join("\n");
}

function stripFrontmatter(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf("---", 3);
    if (end !== -1) {
      return trimmed.slice(end + 3).trim();
    }
  }
  return trimmed;
}

function buildPage(data: NewPageReduceOutput | MergeReduceOutput): string {
  const frontmatter = buildFrontmatter(data);
  const body = stripFrontmatter(data.content);
  return frontmatter + "\n\n" + body + "\n";
}

function resolveSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export function apply(
  reduceDir: string,
  wikiDir: string = join(process.cwd(), "wiki/pages"),
  backupDir: string = join(process.cwd(), "wiki/pages-pre-import"),
): void {
  // Read all reduce outputs
  const jsonFiles = readdirSync(reduceDir).filter(
    (f) => f.endsWith(".json") && !f.startsWith("group-") && !f.startsWith("merge-")
  );

  if (jsonFiles.length === 0) {
    console.error("No reduce output files found in", reduceDir);
    process.exit(1);
  }

  const newPages: { slug: string; category: string; summary: string }[] = [];
  const merges: { slug: string; changelog: string }[] = [];
  const stagedSlugs = new Set<string>();
  const pageFiles = new Map<string, string>(); // slug -> content

  // Read existing page slugs
  const existingSlugs = new Set<string>();
  if (existsSync(wikiDir)) {
    for (const f of readdirSync(wikiDir)) {
      if (f.endsWith(".md")) existingSlugs.add(f.replace(".md", ""));
    }
  }

  for (const file of jsonFiles) {
    const data = JSON.parse(readFileSync(join(reduceDir, file), "utf-8"));
    const isMerge = data.action === "update";

    // Resolve slug collisions for new pages (merges keep their slug)
    let slug = data.slug;
    if (!isMerge) {
      slug = resolveSlug(slug, new Set([...stagedSlugs, ...existingSlugs]));
    }
    stagedSlugs.add(slug);

    const content = buildPage(data);
    pageFiles.set(slug, content);

    if (isMerge) {
      merges.push({ slug, changelog: data.changelog });
    } else {
      newPages.push({ slug, category: data.category, summary: data.summary });
    }
  }

  // Step 1: Back up existing wiki/pages
  if (existsSync(backupDir)) {
    console.error(
      "wiki/pages-pre-import already exists. Remove it first or use --revert."
    );
    process.exit(1);
  }

  if (existsSync(wikiDir)) {
    renameSync(wikiDir, backupDir);
    console.log("Backed up wiki/pages → wiki/pages-pre-import");
  }

  // Step 2: Create new wiki/pages with existing + new pages
  mkdirSync(wikiDir, { recursive: true });

  // Copy existing pages from backup
  if (existsSync(backupDir)) {
    for (const f of readdirSync(backupDir)) {
      if (f.endsWith(".md")) {
        copyFileSync(join(backupDir, f), join(wikiDir, f));
      }
    }
    console.log(`Copied ${existingSlugs.size} existing pages from backup`);
  }

  // Write new and merged pages (overwriting existing for merges)
  for (const [slug, content] of pageFiles) {
    writeFileSync(join(wikiDir, `${slug}.md`), content);
  }

  // Summary
  console.log(
    `\nApplied ${newPages.length} new pages and ${merges.length} merges.`
  );
  console.log("Previous wiki backed up to wiki/pages-pre-import/\n");

  console.log(`New pages (${newPages.length}):`);
  for (const p of newPages.sort((a, b) => a.category.localeCompare(b.category))) {
    console.log(`  ${p.category}/${p.slug} — ${p.summary}`);
  }

  if (merges.length > 0) {
    console.log(`\nMerged into existing (${merges.length}):`);
    for (const m of merges) {
      console.log(`  ${m.slug} — ${m.changelog}`);
    }
  }

  console.log(
    "\nBrowse the wiki to preview, then either commit or revert."
  );
}

export function revert(
  wikiDir: string = join(process.cwd(), "wiki/pages"),
  backupDir: string = join(process.cwd(), "wiki/pages-pre-import"),
): void {
  if (!existsSync(backupDir)) {
    console.error("No backup found at wiki/pages-pre-import/");
    process.exit(1);
  }

  if (existsSync(wikiDir)) {
    // Remove current wiki/pages
    const files = readdirSync(wikiDir);
    for (const f of files) {
      Bun.spawnSync(["rm", join(wikiDir, f)]);
    }
    Bun.spawnSync(["rmdir", wikiDir]);
  }

  renameSync(backupDir, wikiDir);
  console.log("Reverted: wiki/pages-pre-import → wiki/pages");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const wikiDir = join(process.cwd(), "wiki/pages");
  const backupDir = join(process.cwd(), "wiki/pages-pre-import");

  if (args.includes("--revert")) {
    revert(wikiDir, backupDir);
  } else {
    const reduceDir = args.find((a) => !a.startsWith("--"));
    if (!reduceDir) {
      console.error(
        "Usage: bun run src/batch-import/apply.ts <reduce-dir> [--revert]"
      );
      process.exit(1);
    }
    apply(reduceDir, wikiDir, backupDir);
  }
}
