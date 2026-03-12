import { readdirSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { tmpdir } from "os";
import type { ManifestFile, Manifest } from "./types";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "wiki", ".meta", ".index",
]);
const MAX_FILE_SIZE = 100 * 1024; // 100KB

export function discoverFiles(repoPath: string): ManifestFile[] {
  const results: ManifestFile[] = [];
  walk(repoPath, repoPath, results);
  return results;
}

function walk(dir: string, repoRoot: string, results: ManifestFile[]): void {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      walk(full, repoRoot, results);
    } else if (entry.endsWith(".md")) {
      if (stat.size > MAX_FILE_SIZE) {
        console.warn(`  skip (>100KB): ${relative(repoRoot, full)}`);
        continue;
      }
      const content = readFileSync(full, "utf-8");
      if (content.trim().length === 0) continue;

      results.push({
        path: full,
        relativePath: relative(repoRoot, full),
        lastModified: getLastModified(full, repoRoot, stat),
        sizeBytes: stat.size,
        content,
      });
    }
  }
}

function getLastModified(filePath: string, repoRoot: string, stat: ReturnType<typeof statSync>): string {
  try {
    const result = Bun.spawnSync(
      ["git", "log", "-1", "--format=%aI", "--", filePath],
      { cwd: repoRoot }
    );
    const gitDate = result.stdout.toString().trim();
    if (gitDate) return gitDate;
  } catch {}
  return stat.mtime.toISOString();
}

export function createManifest(repoPath: string): Manifest {
  const files = discoverFiles(repoPath);
  const tmpDir = mkdtempSync(join(tmpdir(), "octowiki-import-"));

  const manifest: Manifest = {
    repoPath,
    createdAt: new Date().toISOString(),
    tmpDir,
    files,
  };

  mkdirSync(join(tmpDir, "map"), { recursive: true });
  mkdirSync(join(tmpDir, "reduce"), { recursive: true });
  mkdirSync(join(tmpDir, "wiki", "pages"), { recursive: true });
  mkdirSync(join(tmpDir, "merges"), { recursive: true });

  writeFileSync(join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return manifest;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const repoPath = args.find((a) => !a.startsWith("--")) || process.cwd();

  console.log(`Discovering markdown files in ${repoPath}...`);

  const manifest = createManifest(repoPath);

  console.log(`\nFound ${manifest.files.length} files.`);
  for (const f of manifest.files) {
    console.log(`  ${f.relativePath} (${f.sizeBytes} bytes, ${f.lastModified})`);
  }
  console.log(`\nManifest written to ${manifest.tmpDir}/manifest.json`);

  if (manifest.files.length > 200 && !force) {
    console.error(`\nERROR: ${manifest.files.length} files found. Use --force to proceed.`);
    process.exit(1);
  }
}
