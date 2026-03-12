import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function callAgent(opts: {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
