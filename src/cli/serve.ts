import { existsSync } from "fs";
import { join } from "path";

export async function run(args: string[], flags: Record<string, string | boolean>): Promise<void> {
  const wikiDir = join(process.cwd(), "wiki");

  if (!existsSync(join(wikiDir, "pages"))) {
    console.error("No wiki found. Run `octowiki init` first.");
    process.exit(1);
  }

  const port = flags.port ? parseInt(flags.port as string, 10) : parseInt(process.env.PORT ?? "4567", 10);

  // Resolve dist path from the octowiki package location
  const distPath = join(import.meta.dir, "../../dist/web");

  const { startServer } = await import("../index");
  await startServer({ wikiDir, port, distPath });
}
