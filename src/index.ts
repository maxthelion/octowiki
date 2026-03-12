import { createApp } from "./server/app";
import { startWatcher } from "./watcher/index";
import { handleSSETrigger, handleHaikuTrigger } from "./watcher/triggers";
import { cleanStaleLock } from "./wiki/lock";
import { isQmdAvailable } from "./search/qmd";
import { join } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";

const WIKI_DIR = process.env.OCTOWIKI_DIR ?? join(process.cwd(), "wiki");
const PORT = parseInt(process.env.PORT ?? "4567", 10);

async function main() {
  console.log(`OctoWiki starting...`);
  console.log(`Wiki directory: ${WIKI_DIR}`);

  // Ensure directories exist
  for (const dir of ["pages", ".meta/pages", ".meta/plans", ".index", "meta"]) {
    mkdirSync(join(WIKI_DIR, dir), { recursive: true });
  }

  // Initialize files if missing
  const queuePath = join(WIKI_DIR, ".meta/queue.json");
  if (!existsSync(queuePath)) {
    writeFileSync(queuePath, "[]");
  }
  const backlinksPath = join(WIKI_DIR, ".meta/backlinks.json");
  if (!existsSync(backlinksPath)) {
    writeFileSync(backlinksPath, "{}");
  }

  // Clean stale locks
  cleanStaleLock(join(WIKI_DIR, ".meta/agent-writing.lock"));

  // Check qmd availability
  const qmdOk = await isQmdAvailable();
  if (!qmdOk) {
    console.warn("qmd CLI not found. Search features will be unavailable.");
    console.warn("Install qmd: https://github.com/qmd/qmd");
  }

  // Start file watcher
  const watcher = startWatcher({
    wikiDir: WIKI_DIR,
    onSSE: handleSSETrigger,
    onHaiku: (files) => handleHaikuTrigger(files, WIKI_DIR),
  });

  // Start HTTP server
  const app = createApp({ wikiDir: WIKI_DIR });

  console.log(`Server listening on http://localhost:${PORT}`);

  Bun.serve({
    port: PORT,
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

main().catch((err) => {
  console.error("Failed to start OctoWiki:", err);
  process.exit(1);
});
