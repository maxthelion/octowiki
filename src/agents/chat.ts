import { callAgent } from "./client";
import type { WikiPage } from "../types";

const CHAT_MODEL = "claude-sonnet-4-6";

export async function chatWithPage(opts: {
  page: WikiPage;
  message: string;
  history: { role: "user" | "agent"; message: string }[];
  searchResults?: unknown[];
}): Promise<{ updatedContent: string; agentMessage: string }> {
  const response = await callAgent({
    model: CHAT_MODEL,
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
