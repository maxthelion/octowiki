export function buildSearchCommand(
  collectionPath: string,
  query: string,
  mode: "search" | "vsearch" | "query" = "search"
): string[] {
  return ["qmd", mode, query, "--json", "--collection", collectionPath];
}

export function buildUpdateCommand(collectionPath: string): string[] {
  return ["qmd", "update", "--collection", collectionPath];
}

export function buildEmbedCommand(collectionPath: string): string[] {
  return ["qmd", "embed", "--collection", collectionPath];
}

export async function isQmdAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["qmd", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

export async function runQmd(args: string[]): Promise<string> {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`qmd failed (exit ${exitCode}): ${stderr}`);
  }

  return stdout;
}

export async function search(
  collectionPath: string,
  query: string,
  mode: "search" | "vsearch" | "query" = "search"
): Promise<unknown[]> {
  try {
    const result = await runQmd(buildSearchCommand(collectionPath, query, mode));
    return JSON.parse(result);
  } catch {
    return [];
  }
}

export async function updateIndex(collectionPath: string): Promise<void> {
  await runQmd(buildUpdateCommand(collectionPath));
}

export async function embedIndex(collectionPath: string): Promise<void> {
  await runQmd(buildEmbedCommand(collectionPath));
}
