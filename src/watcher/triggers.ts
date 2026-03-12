import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { readPage, listPages } from "../wiki/pages";
import { updateFrontmatter } from "../wiki/frontmatter";
import { computeBacklinks, saveBacklinks } from "../wiki/backlinks";
import { interpretChange } from "../agents/haiku";
import { isLocked } from "../wiki/lock";
import { updateIndex, embedIndex } from "../search/qmd";
import { sseEmitter } from "../server/sse";
import type { ChangeSummary, TagUndoEntry } from "../types";

export async function handleHaikuTrigger(
  files: string[],
  wikiDir: string
): Promise<void> {
  const pagesDir = join(wikiDir, "pages");
  const lockPath = join(wikiDir, ".meta/agent-writing.lock");

  if (isLocked(lockPath)) return;

  const pageFiles = files
    .filter((f) => f.startsWith("pages/") && f.endsWith(".md"))
    .map((f) => f.replace("pages/", "").replace(".md", ""));

  for (const slug of pageFiles) {
    const page = readPage(pagesDir, slug);
    if (!page || page.lastModifiedBy === "agent") continue;

    const allPages = listPages(pagesDir);
    const summaries = allPages.map((p) => ({
      slug: p.slug, title: p.title, summary: p.summary,
    }));

    try {
      const result = await interpretChange({
        page,
        diff: "",
        allPageSummaries: summaries,
        taxonomyPath: join(wikiDir, "meta/taxonomy.md"),
      });

      // Auto-apply suggested tags
      if (result.suggestedTags && result.suggestedTags.length > 0) {
        const rawPage = readFileSync(join(pagesDir, `${slug}.md`), "utf-8");
        const undoEntry: TagUndoEntry = {
          timestamp: new Date().toISOString(),
          page: slug,
          previousTags: page.tags,
          newTags: result.suggestedTags,
        };

        const updated = updateFrontmatter(rawPage, {
          tags: result.suggestedTags,
          "last-modified-by": "agent",
        });
        writeFileSync(join(pagesDir, `${slug}.md`), updated);

        const metaPagesDir = join(wikiDir, ".meta/pages");
        mkdirSync(metaPagesDir, { recursive: true });
        const metaPath = join(metaPagesDir, `${slug}.json`);
        const meta = existsSync(metaPath)
          ? JSON.parse(readFileSync(metaPath, "utf-8"))
          : { page: slug, history: [] };
        meta.tagUndoLog = meta.tagUndoLog ?? [];
        meta.tagUndoLog.push(undoEntry);
        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      }

      // Append to queue
      const queuePath = join(wikiDir, ".meta/queue.json");
      const queue: ChangeSummary[] = existsSync(queuePath)
        ? JSON.parse(readFileSync(queuePath, "utf-8"))
        : [];
      queue.push(result.summary);
      writeFileSync(queuePath, JSON.stringify(queue, null, 2));

      // Update backlinks
      const backlinks = computeBacklinks(pagesDir);
      saveBacklinks(join(wikiDir, ".meta/backlinks.json"), backlinks);

      // Update qmd index
      try {
        await updateIndex(join(wikiDir, ".index"));
        if (result.isSignificant) {
          embedIndex(join(wikiDir, ".index")).catch(() => {});
        }
      } catch { /* qmd not available */ }

      sseEmitter.emit({ type: "feed-updated" });
    } catch (err) {
      console.error(`Haiku interpretation failed for ${slug}:`, err);
    }
  }
}

export function handleSSETrigger(files: string[]): void {
  for (const file of files) {
    if (file.startsWith("pages/")) {
      const slug = file.replace("pages/", "").replace(".md", "");
      sseEmitter.emit({ type: "page-changed", slug });
    }
  }
}
