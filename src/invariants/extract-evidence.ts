import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, relative } from "path";
import type { InvariantTree } from "./types";

const SRC_DIR = join(import.meta.dir, "../../src");
const INVARIANTS_DIR = join(import.meta.dir, "../../wiki/invariants");

// Maps invariant group names to source directories.
// Groups not listed here use convention: group name matches src/ subdirectory.
const GROUP_DIR_MAP: Record<string, string[]> = {
  "agent-pipeline": ["agents", "watcher"],
  "agent-integration": ["agents", "watcher"],
  "system-architecture": ["server", "wiki", "agents", "watcher", "search"],
  "data-flow-pipelines": ["server", "watcher", "agents"],
  "sse-implementation": ["server"],
  "frontend-routing": ["server"],
  "chat-in-page": ["server/routes", "agents"],
  "wiki-file-structure": ["wiki"],
  "wiki-source-of-truth": ["wiki"],
  "wikilinks-syntax": ["wiki"],
  "backlinks-computation": ["wiki"],
  "bun-runtime": ["."],
  "configuration-env-vars": ["."],
  "loop-prevention": ["wiki", "watcher"],
  "add-page-flow": ["wiki", "server/routes"],
  "tag-auto-apply": ["agents", "wiki"],
  "error-handling": ["server", "agents", "watcher"],
  "testing-strategy": ["."],
};

export interface EvidenceExtractionInput {
  group: string;
  invariants: { id: string; description: string }[];
  sourceFiles: { path: string; content: string }[];
  testFiles: { path: string; content: string }[];
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
      results.push(...collectFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

function collectTestFiles(dir: string): string[] {
  const testDir = join(dir, "__tests__");
  if (!existsSync(testDir)) return [];
  return readdirSync(testDir)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => join(testDir, f));
}

export function prepareEvidenceInputs(tree: InvariantTree): EvidenceExtractionInput[] {
  // Group invariants by top-level segment
  const groups = new Map<string, { id: string; description: string }[]>();
  for (const inv of tree.invariants) {
    const groupName = inv.id.split(".")[0];
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName)!.push({ id: inv.id, description: inv.description });
  }

  const inputs: EvidenceExtractionInput[] = [];

  for (const [group, invariants] of groups) {
    const dirs = GROUP_DIR_MAP[group] || [group];
    const sourceFilePaths = new Set<string>();
    const testFilePaths = new Set<string>();

    for (const d of dirs) {
      const fullDir = d === "." ? SRC_DIR : join(SRC_DIR, d);
      for (const f of collectFiles(fullDir)) sourceFilePaths.add(f);
      for (const f of collectTestFiles(fullDir)) testFilePaths.add(f);
    }

    const readFile = (p: string) => ({
      path: relative(join(SRC_DIR, ".."), p),
      content: readFileSync(p, "utf-8"),
    });

    inputs.push({
      group,
      invariants,
      sourceFiles: Array.from(sourceFilePaths).map(readFile),
      testFiles: Array.from(testFilePaths).map(readFile),
    });
  }

  return inputs;
}

if (import.meta.main) {
  const treeFile = process.argv[2] || join(INVARIANTS_DIR, "tree.json");
  const outDir = process.argv[3] || join(INVARIANTS_DIR, "staging");

  const tree: InvariantTree = JSON.parse(readFileSync(treeFile, "utf-8"));
  const inputs = prepareEvidenceInputs(tree);

  mkdirSync(outDir, { recursive: true });
  for (const input of inputs) {
    writeFileSync(
      join(outDir, `evidence-${input.group}.json`),
      JSON.stringify(input, null, 2)
    );
    console.log(`  ${input.group}: ${input.invariants.length} invariants, ${input.sourceFiles.length} source files, ${input.testFiles.length} test files`);
  }
  console.log(`Wrote ${inputs.length} evidence extraction inputs to ${outDir}`);
}
