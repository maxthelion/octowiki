import { callAgent } from "./client";
import type { WikiPage, ChangeSummary } from "../types";
import { loadTaxonomy } from "../wiki/taxonomy";

export { chatWithPage } from "./chat";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

export async function interpretChange(opts: {
  page: WikiPage;
  diff: string;
  allPageSummaries: { slug: string; title: string; summary: string }[];
  taxonomyPath: string;
}): Promise<{
  summary: ChangeSummary;
  suggestedTags?: string[];
  isSignificant: boolean;
}> {
  const taxonomy = loadTaxonomy(opts.taxonomyPath);

  const response = await callAgent({
    model: HAIKU_MODEL,
    system: `You are a wiki change interpreter. Analyze the diff and produce a JSON response with:
- "summary": a human-readable interpretation of what changed and why it matters (not a raw diff description)
- "affectedPages": slugs of other pages that may be affected by this change
- "tags": relevant tags from the taxonomy for this change
- "suggestedPageTags": tags that should be applied to the page itself
- "isSignificant": true if this change is substantial enough to warrant re-embedding (new concepts, structural changes, not just typo fixes)

Available taxonomy tags: ${Object.keys(taxonomy.tags).join(", ")}
Known pages: ${opts.allPageSummaries.map((p) => `${p.slug}: ${p.summary}`).join("\n")}`,
    messages: [
      {
        role: "user",
        content: `Page: ${opts.page.slug} (${opts.page.title})
Current tags: ${opts.page.tags.join(", ")}

Diff:
${opts.diff}

Current content:
${opts.page.content}`,
      },
    ],
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { summary: response, affectedPages: [], tags: [], isSignificant: false };
  }

  const changeSummary: ChangeSummary = {
    id: `chg-${Date.now()}`,
    timestamp: new Date().toISOString(),
    page: opts.page.slug,
    tags: (parsed.tags as string[]) ?? [],
    summary: (parsed.summary as string) ?? "Change detected",
    affectedPages: (parsed.affectedPages as string[]) ?? [],
    rawDiff: opts.diff,
  };

  return {
    summary: changeSummary,
    suggestedTags: parsed.suggestedPageTags as string[] | undefined,
    isSignificant: (parsed.isSignificant as boolean) ?? false,
  };
}
