import { callAgent } from "./client";
import type { WikiPage, ChangeSummary } from "../types";
import { loadTaxonomy } from "../wiki/taxonomy";

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

export async function chatWithPage(opts: {
  page: WikiPage;
  message: string;
  history: { role: "user" | "agent"; message: string }[];
  searchResults?: unknown[];
}): Promise<{ updatedContent: string; agentMessage: string }> {
  const response = await callAgent({
    model: "claude-sonnet-4-6",
    maxTokens: 8192,
    system: `You are a wiki page editor. The user sends you a message about the current page. You respond by:
1. Editing the page content to address the user's request
2. Providing a brief message explaining what you changed

Respond with JSON:
- "updatedContent": the full updated page content (markdown, no frontmatter)
- "agentMessage": a brief explanation of what you changed

Preserve the existing structure and content. Only modify what the user asks for.`,
    messages: [
      ...opts.history.map((h) => ({
        role: h.role === "user" ? ("user" as const) : ("assistant" as const),
        content: h.message,
      })),
      {
        role: "user" as const,
        content: `Current page content:
\`\`\`markdown
${opts.page.content}
\`\`\`

User message: ${opts.message}`,
      },
    ],
  });

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(response);
  } catch {
    return { updatedContent: opts.page.content, agentMessage: response };
  }
  return {
    updatedContent: parsed.updatedContent ?? opts.page.content,
    agentMessage: parsed.agentMessage ?? "Updated the page.",
  };
}
