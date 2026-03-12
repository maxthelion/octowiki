import { callAgent } from "./agents/client";
import { writePage } from "./wiki/pages";
import { join } from "path";
import { readFileSync, mkdirSync, readdirSync, statSync } from "fs";

const WIKI_DIR = process.env.OCTOWIKI_DIR ?? join(process.cwd(), "wiki");
const REPO_DIR = process.cwd();

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "wiki", ".meta", ".index"]);

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      results.push(full);
    }
  }

  return results;
}

async function generateWikiPage(filePath: string, content: string): Promise<{
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  body: string;
}> {
  const relativePath = filePath.replace(REPO_DIR + "/", "");

  const response = await callAgent({
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    system: `You convert source documents into wiki pages. Given a markdown file from a codebase, produce a structured wiki page.

Respond with JSON only:
{
  "slug": "kebab-case-name (max 60 chars)",
  "title": "Human-readable title",
  "category": "one of: architecture, guide, reference, spec, overview",
  "tags": ["relevant", "tags"],
  "summary": "One sentence summary",
  "body": "The wiki page body in markdown. Preserve the important content but restructure for a wiki reader. Use [[slug]] wikilinks where you can infer connections to other pages. Keep it concise."
}`,
    messages: [
      {
        role: "user",
        content: `File: ${relativePath}\n\n${content}`,
      },
    ],
  });

  try {
    return JSON.parse(response);
  } catch {
    // Try extracting JSON from response
    const match = response.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse response for ${relativePath}`);
  }
}

async function main() {
  const pagesDir = join(WIKI_DIR, "pages");
  mkdirSync(pagesDir, { recursive: true });

  const files = findMarkdownFiles(REPO_DIR);

  if (files.length === 0) {
    console.log("No markdown files found.");
    return;
  }

  console.log(`Found ${files.length} markdown files:`);
  for (const f of files) {
    console.log(`  ${f.replace(REPO_DIR + "/", "")}`);
  }
  console.log();

  for (const filePath of files) {
    const relativePath = filePath.replace(REPO_DIR + "/", "");
    const content = readFileSync(filePath, "utf-8");

    if (content.trim().length === 0) {
      console.log(`  skip (empty): ${relativePath}`);
      continue;
    }

    process.stdout.write(`  ${relativePath} → `);

    try {
      const page = await generateWikiPage(filePath, content);

      writePage(pagesDir, page.slug, {
        title: page.title,
        category: page.category,
        tags: page.tags,
        summary: page.summary,
        "last-modified-by": "agent",
      }, page.body);

      console.log(`wiki/pages/${page.slug}.md`);
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\nBootstrap complete.");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
