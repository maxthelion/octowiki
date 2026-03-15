import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export interface SpecExtractionBatch {
  category: string;
  pages: { slug: string; content: string }[];
}

export function prepareSpecBatches(
  wikiDir: string = join(process.cwd(), "wiki/pages"),
): SpecExtractionBatch[] {
  const files = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
  const byCategory = new Map<string, { slug: string; content: string }[]>();

  for (const file of files) {
    const content = readFileSync(join(wikiDir, file), "utf-8");
    const slug = file.replace(".md", "");

    // Extract category from frontmatter
    const match = content.match(/^category:\s*(.+)$/m);
    const category = match ? match[1].trim() : "uncategorised";

    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({ slug, content });
  }

  return Array.from(byCategory.entries()).map(([category, pages]) => ({
    category,
    pages,
  }));
}

export function writeSpecBatches(batches: SpecExtractionBatch[], outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < batches.length; i++) {
    writeFileSync(
      join(outDir, `batch-${i}.json`),
      JSON.stringify(batches[i], null, 2)
    );
  }
  console.log(`Wrote ${batches.length} spec extraction batches to ${outDir}`);
}

if (import.meta.main) {
  const outDir = process.argv[2] || join(process.cwd(), "wiki/invariants/staging");
  const batches = prepareSpecBatches();
  writeSpecBatches(batches, outDir);
  for (const b of batches) {
    console.log(`  ${b.category}: ${b.pages.length} pages`);
  }
}
