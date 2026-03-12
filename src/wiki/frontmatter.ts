import matter from "gray-matter";
import type { PageFrontmatter } from "../types";

const DEFAULTS: PageFrontmatter = {
  title: "",
  category: "",
  tags: [],
  summary: "",
  "last-modified-by": "user",
};

export function parseFrontmatter(raw: string): {
  data: PageFrontmatter;
  content: string;
} {
  const parsed = matter(raw);
  return {
    data: { ...DEFAULTS, ...parsed.data } as PageFrontmatter,
    content: parsed.content.trim(),
  };
}

export function updateFrontmatter(
  raw: string,
  updates: Partial<PageFrontmatter>
): string {
  const parsed = matter(raw);
  const merged = { ...parsed.data, ...updates };
  return matter.stringify(parsed.content, merged);
}

export function serializePage(
  frontmatter: PageFrontmatter,
  content: string
): string {
  return matter.stringify(content, frontmatter);
}
