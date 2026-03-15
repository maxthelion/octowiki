import { createApp } from "./server/app";
import { startWatcher } from "./watcher/index";
import { handleSSETrigger, handleHaikuTrigger } from "./watcher/triggers";
import { cleanStaleLock } from "./wiki/lock";
import { isQmdAvailable } from "./search/qmd";
import { join } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";

export interface ServerConfig {
  wikiDir: string;
  port: number;
  distPath?: string;
}

export async function startServer(config: ServerConfig) {
  const { wikiDir, port, distPath } = config;

  console.log(`OctoWiki starting...`);
  console.log(`Wiki directory: ${wikiDir}`);

  // Ensure directories exist
  for (const dir of ["pages", ".meta/pages", ".meta/plans", ".index", "meta"]) {
    mkdirSync(join(wikiDir, dir), { recursive: true });
  }

  // Initialize files if missing
  const queuePath = join(wikiDir, ".meta/queue.json");
  if (!existsSync(queuePath)) {
    writeFileSync(queuePath, "[]");
  }
  const backlinksPath = join(wikiDir, ".meta/backlinks.json");
  if (!existsSync(backlinksPath)) {
    writeFileSync(backlinksPath, "{}");
  }

  // Clean stale locks
  cleanStaleLock(join(wikiDir, ".meta/agent-writing.lock"));

  // Check qmd availability
  const qmdOk = await isQmdAvailable();
  if (!qmdOk) {
    console.warn("qmd CLI not found. Search features will be unavailable.");
    console.warn("Install qmd: https://github.com/qmd/qmd");
  }

  // Start file watcher
  const watcher = startWatcher({
    wikiDir,
    onSSE: handleSSETrigger,
    onHaiku: (files) => handleHaikuTrigger(files, wikiDir),
  });

  // Start HTTP server
  const app = createApp({ wikiDir, distPath });

  console.log(`Server listening on http://localhost:${port}`);

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    watcher.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  const wikiDir = process.env.OCTOWIKI_DIR ?? join(process.cwd(), "wiki");
  const port = parseInt(process.env.PORT ?? "4567", 10);
  startServer({ wikiDir, port }).catch((err) => {
    console.error("Failed to start OctoWiki:", err);
    process.exit(1);
  });
}
