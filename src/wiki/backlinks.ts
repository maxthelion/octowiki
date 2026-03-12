import { readFileSync, writeFileSync, existsSync } from "fs";
import { listPages } from "./pages";
import { parseWikilinks } from "./wikilinks";

export type BacklinksMap = Record<string, string[]>;

export function computeBacklinks(pagesDir: string): BacklinksMap {
  const pages = listPages(pagesDir);
  const backlinks: BacklinksMap = {};

  for (const page of pages) {
    const links = parseWikilinks(page.content);
    for (const link of links) {
      if (link.type === "link" || link.type === "embed" || link.type === "full-embed") {
        if (!backlinks[link.target]) backlinks[link.target] = [];
        if (!backlinks[link.target].includes(page.slug)) {
          backlinks[link.target].push(page.slug);
        }
      }
    }
  }

  return backlinks;
}

export function loadBacklinks(filePath: string): BacklinksMap {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function saveBacklinks(filePath: string, backlinks: BacklinksMap): void {
  writeFileSync(filePath, JSON.stringify(backlinks, null, 2));
}
