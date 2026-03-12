import { listPages } from "./wiki/pages";
import { join } from "path";
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, existsSync } from "fs";

const WIKI_DIR = join(process.cwd(), "wiki");
const DIST_DIR = join(process.cwd(), "dist/web");
const API_DIR = join(DIST_DIR, "api");

function main() {
  const pagesDir = join(WIKI_DIR, "pages");
  const pages = listPages(pagesDir);

  console.log(`Building static site from ${pages.length} wiki pages...`);

  // Create API directories
  mkdirSync(join(API_DIR, "pages"), { recursive: true });

  // /api/pages → page summaries (no content)
  const summaries = pages.map(({ content, ...rest }) => rest);
  writeFileSync(join(API_DIR, "pages.json"), JSON.stringify(summaries));

  // /api/pages/:slug → individual pages
  for (const page of pages) {
    writeFileSync(join(API_DIR, "pages", `${page.slug}.json`), JSON.stringify(page));
  }

  // /api/feed → empty
  writeFileSync(join(API_DIR, "feed.json"), "[]");

  // /api/inbox → empty
  writeFileSync(join(API_DIR, "inbox.json"), "[]");

  // /api/taxonomy → empty
  writeFileSync(join(API_DIR, "taxonomy.json"), "{}");

  // Write _redirects for Cloudflare Pages SPA routing
  // Static JSON files are served directly, everything else falls back to index.html
  const redirects = [
    "/api/pages/:slug /api/pages/:slug.json 200",
    "/api/pages /api/pages.json 200",
    "/api/feed /api/feed.json 200",
    "/api/inbox /api/inbox.json 200",
    "/api/taxonomy /api/taxonomy.json 200",
    "/* /index.html 200",
  ].join("\n");

  writeFileSync(join(DIST_DIR, "_redirects"), redirects);

  console.log(`  ${pages.length} page JSON files`);
  console.log(`  Static API endpoints`);
  console.log(`  _redirects for SPA routing`);
  console.log(`\nStatic site ready at dist/web/`);
}

main();
