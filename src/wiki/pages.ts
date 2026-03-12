import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { parseFrontmatter, serializePage } from "./frontmatter";
import type { WikiPage, PageFrontmatter } from "../types";

export function readPage(pagesDir: string, slug: string): WikiPage | null {
  const filePath = join(pagesDir, `${slug}.md`);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = parseFrontmatter(raw);

  return {
    slug,
    title: data.title,
    category: data.category,
    tags: data.tags,
    summary: data.summary,
    lastModifiedBy: data["last-modified-by"],
    lastSummarised: data["last-summarised"],
    content,
  };
}

export function writePage(
  pagesDir: string,
  slug: string,
  frontmatter: PageFrontmatter,
  content: string
): void {
  const filePath = join(pagesDir, `${slug}.md`);
  writeFileSync(filePath, serializePage(frontmatter, content));
}

export function listPages(pagesDir: string): WikiPage[] {
  if (!existsSync(pagesDir)) return [];

  return readdirSync(pagesDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readPage(pagesDir, f.replace(".md", "")))
    .filter((p): p is WikiPage => p !== null);
}

export function deletePage(pagesDir: string, slug: string): boolean {
  const filePath = join(pagesDir, `${slug}.md`);
  if (!existsSync(filePath)) return false;
  unlinkSync(filePath);
  return true;
}
