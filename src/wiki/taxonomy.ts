import { readFileSync, existsSync } from "fs";

export interface Taxonomy {
  categories: string[];
  tags: Record<string, string>;
}

export function loadTaxonomy(filePath: string): Taxonomy {
  if (!existsSync(filePath)) {
    return { categories: [], tags: {} };
  }

  const raw = readFileSync(filePath, "utf-8");
  const categories: string[] = [];
  const tags: Record<string, string> = {};
  let section: "categories" | "tags" | null = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("## Categories")) {
      section = "categories";
    } else if (line.startsWith("## ") && section !== null) {
      // Any other ## heading ends the current section
      section = line.startsWith("## Tags") ? "tags" : null;
    } else if (section === "categories") {
      // Parse ### heading format (from category-taxonomy.md)
      if (line.startsWith("### ")) {
        categories.push(line.slice(4).trim());
      }
      // Parse - item format (legacy)
      else if (line.startsWith("- ")) {
        categories.push(line.slice(2).split(" — ")[0].trim().replace(/`/g, ""));
      }
    } else if (line.startsWith("- ") && section === "tags") {
      const parts = line.slice(2).split(" — ");
      const name = parts[0].trim().replace(/`/g, "").replace(/^#/, "");
      const desc = parts[1]?.trim() ?? "";
      tags[name] = desc;
    }
  }

  return { categories, tags };
}
