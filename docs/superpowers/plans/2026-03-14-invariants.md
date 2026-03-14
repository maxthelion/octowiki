# Invariants System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-stage pipeline that extracts invariants from wiki pages and code independently, then compares them to surface implementation gaps.

**Architecture:** Three isolated stages — spec extraction (Sonnet reads wiki), evidence extraction (Sonnet reads code+tests), comparison (Sonnet reads both JSON outputs). Each stage's output is JSON in `wiki/invariants/`. Results are also rendered as browsable markdown pages.

**Tech Stack:** Bun, TypeScript, Claude Sonnet subagents, existing wiki infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-14-invariants-design.md`

---

## File Structure

```
src/invariants/
  types.ts           # Data types for invariants, evidence, report
  extract-spec.ts    # Stage 1: read wiki pages, output tree.json
  extract-evidence.ts # Stage 2: read code+tests, output evidence.json
  compare.ts         # Stage 3: read both JSONs, output report + markdown
  render.ts          # Render invariant tree as wiki markdown pages
  __tests__/
    types.test.ts
    render.test.ts
    compare.test.ts

wiki/invariants/     # Output directory (created by pipeline)
  tree.json
  evidence.json
  report.json
  *.md               # Rendered invariant pages

.claude/skills/octowiki-invariants/
  SKILL.md           # Skill definition for /octowiki:invariants
```

---

## Chunk 1: Data Types and Rendering

### Task 1: Define invariant types

**Files:**
- Create: `src/invariants/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
export interface InvariantNode {
  id: string;           // dotted path, e.g. "agent-pipeline.watcher.debounce"
  parent: string | null;
  description: string;
  kind: "behavioural" | "architectural";
  verificationMethod: "unit-test" | "integration-test" | "visual-qa" | "manual-check" | "static-analysis";
  sources: string[];    // wiki page slugs
}

export interface InvariantTree {
  extractedAt: string;  // ISO 8601
  invariants: InvariantNode[];
}

export interface EvidenceEntry {
  invariantId: string;
  implemented: boolean;
  tested: boolean;
  codeLocations: string[];
  testLocations: string[];
}

export interface UnspecifiedInvariant {
  description: string;
  codeLocations: string[];
  testLocations: string[];
}

export interface EvidenceReport {
  extractedAt: string;
  evidence: EvidenceEntry[];
  unspecified: UnspecifiedInvariant[];
}

export type InvariantStatus =
  | "implemented-tested"
  | "implemented-untested"
  | "specified-only"
  | "unspecified";

export interface ResolvedInvariant {
  id: string;
  parent: string | null;
  description: string;
  kind: "behavioural" | "architectural";
  verificationMethod: string;
  sources: string[];
  status: InvariantStatus;
  codeLocations: string[];
  testLocations: string[];
}

export interface ComparisonReport {
  generatedAt: string;
  groups: {
    name: string;
    coverage: number;    // 0.0-1.0
    invariants: ResolvedInvariant[];
  }[];
  unspecified: UnspecifiedInvariant[];
  summary: {
    total: number;
    implementedTested: number;
    implementedUntested: number;
    specifiedOnly: number;
    unspecified: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/invariants/types.ts
git commit -m "feat(invariants): add data types for invariant tree, evidence, and comparison"
```

### Task 2: Write the render function

**Files:**
- Create: `src/invariants/render.ts`
- Create: `src/invariants/__tests__/render.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect, describe } from "bun:test";
import { renderInvariantPage } from "../render";
import type { ResolvedInvariant, UnspecifiedInvariant } from "../types";

describe("renderInvariantPage", () => {
  test("renders a group with hierarchy and gap table", () => {
    const invariants: ResolvedInvariant[] = [
      {
        id: "test-group.parent",
        parent: null,
        description: "The system does X",
        kind: "behavioural",
        verificationMethod: "integration-test",
        sources: ["system-architecture"],
        status: "implemented-tested",
        codeLocations: ["src/x.ts"],
        testLocations: ["src/__tests__/x.test.ts"],
      },
      {
        id: "test-group.parent.child",
        parent: "test-group.parent",
        description: "Specifically it does Y",
        kind: "architectural",
        verificationMethod: "static-analysis",
        sources: ["system-architecture"],
        status: "specified-only",
        codeLocations: [],
        testLocations: [],
      },
    ];

    const result = renderInvariantPage("test-group", invariants, []);

    // Has frontmatter
    expect(result).toContain("title: Test Group Invariants");
    expect(result).toContain("group: test-group");
    expect(result).toContain("coverage: 50%");

    // Has parent as h2
    expect(result).toContain("## The system does X");
    expect(result).toContain("**Kind:** behavioural");
    expect(result).toContain("**Status:** implemented-tested");

    // Has child as h3
    expect(result).toContain("### Specifically it does Y");
    expect(result).toContain("**Status:** specified-only");

    // Has gaps table
    expect(result).toContain("## Gaps");
    expect(result).toContain("Specifically it does Y");
    expect(result).toContain("specified-only");
  });

  test("no gaps section when fully covered", () => {
    const invariants: ResolvedInvariant[] = [
      {
        id: "full.one",
        parent: null,
        description: "Everything works",
        kind: "behavioural",
        verificationMethod: "unit-test",
        sources: ["skills"],
        status: "implemented-tested",
        codeLocations: ["src/a.ts"],
        testLocations: ["src/__tests__/a.test.ts"],
      },
    ];

    const result = renderInvariantPage("full", invariants, []);
    expect(result).not.toContain("## Gaps");
    expect(result).toContain("coverage: 100%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/invariants/__tests__/render.test.ts`
Expected: FAIL — renderInvariantPage not found

- [ ] **Step 3: Write the implementation**

```typescript
import type { ResolvedInvariant, UnspecifiedInvariant } from "./types";

export function renderInvariantPage(
  groupName: string,
  invariants: ResolvedInvariant[],
  unspecified: UnspecifiedInvariant[]
): string {
  const title = groupName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const total = invariants.length;
  const covered = invariants.filter(
    (i) => i.status === "implemented-tested" || i.status === "implemented-untested"
  ).length;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const lines: string[] = [
    "---",
    `title: ${title} Invariants`,
    `group: ${groupName}`,
    `generated: ${new Date().toISOString().split("T")[0]}`,
    `coverage: ${coveragePct}%`,
    "---",
    "",
  ];

  // Build hierarchy: roots first, then children
  const roots = invariants.filter((i) => i.parent === null);
  const childrenOf = (parentId: string) =>
    invariants.filter((i) => i.parent === parentId);

  function renderNode(node: ResolvedInvariant, depth: number): void {
    const heading = "#".repeat(depth + 2); // h2 for roots, h3 for children, etc.
    lines.push(`${heading} ${node.description}`);
    lines.push("");
    lines.push(
      `**Kind:** ${node.kind} | **Status:** ${node.status}`
    );
    lines.push(`**Verification:** ${node.verificationMethod} | **Source:** ${node.sources.map((s) => `[[${s}]]`).join(", ")}`);

    if (node.codeLocations.length > 0) {
      lines.push(
        `**Evidence:** ${node.codeLocations.map((l) => "`" + l + "`").join(", ")}`
      );
    }
    if (node.testLocations.length > 0) {
      lines.push(
        `**Tests:** ${node.testLocations.map((l) => "`" + l + "`").join(", ")}`
      );
    }

    lines.push("");

    for (const child of childrenOf(node.id)) {
      renderNode(child, depth + 1);
    }
  }

  for (const root of roots) {
    renderNode(root, 0);
  }

  // Gaps section
  const gaps = invariants.filter(
    (i) => i.status === "specified-only" || i.status === "implemented-untested"
  );
  if (gaps.length > 0 || unspecified.length > 0) {
    lines.push("## Gaps");
    lines.push("");
    lines.push("| Invariant | Status | Notes |");
    lines.push("|---|---|---|");
    for (const g of gaps) {
      const notes =
        g.status === "specified-only"
          ? "No code evidence found"
          : "No test coverage";
      lines.push(`| ${g.description} | ${g.status} | ${notes} |`);
    }
    for (const u of unspecified) {
      lines.push(
        `| ${u.description} | unspecified | Found in ${u.codeLocations.join(", ")} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/invariants/__tests__/render.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/invariants/render.ts src/invariants/__tests__/render.test.ts
git commit -m "feat(invariants): add render function for invariant wiki pages"
```

### Task 3: Write the compare function

**Files:**
- Create: `src/invariants/compare.ts`
- Create: `src/invariants/__tests__/compare.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test, expect, describe } from "bun:test";
import { compareTreeAndEvidence } from "../compare";
import type { InvariantTree, EvidenceReport } from "../types";

describe("compareTreeAndEvidence", () => {
  test("merges tree and evidence into resolved invariants with correct statuses", () => {
    const tree: InvariantTree = {
      extractedAt: "2026-03-14",
      invariants: [
        {
          id: "g.tested",
          parent: null,
          description: "Has test",
          kind: "behavioural",
          verificationMethod: "unit-test",
          sources: ["skills"],
        },
        {
          id: "g.untested",
          parent: null,
          description: "No test",
          kind: "behavioural",
          verificationMethod: "unit-test",
          sources: ["skills"],
        },
        {
          id: "g.missing",
          parent: null,
          description: "Not implemented",
          kind: "behavioural",
          verificationMethod: "integration-test",
          sources: ["skills"],
        },
      ],
    };

    const evidence: EvidenceReport = {
      extractedAt: "2026-03-14",
      evidence: [
        {
          invariantId: "g.tested",
          implemented: true,
          tested: true,
          codeLocations: ["src/a.ts"],
          testLocations: ["src/__tests__/a.test.ts"],
        },
        {
          invariantId: "g.untested",
          implemented: true,
          tested: false,
          codeLocations: ["src/b.ts"],
          testLocations: [],
        },
      ],
      unspecified: [
        {
          description: "Extra behaviour",
          codeLocations: ["src/c.ts"],
          testLocations: [],
        },
      ],
    };

    const report = compareTreeAndEvidence(tree, evidence);

    expect(report.summary.total).toBe(3);
    expect(report.summary.implementedTested).toBe(1);
    expect(report.summary.implementedUntested).toBe(1);
    expect(report.summary.specifiedOnly).toBe(1);
    expect(report.summary.unspecified).toBe(1);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0].name).toBe("g");
    expect(report.groups[0].coverage).toBeCloseTo(0.667, 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/invariants/__tests__/compare.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```typescript
import type {
  InvariantTree,
  EvidenceReport,
  ComparisonReport,
  ResolvedInvariant,
  InvariantStatus,
} from "./types";

export function compareTreeAndEvidence(
  tree: InvariantTree,
  evidence: EvidenceReport
): ComparisonReport {
  const evidenceMap = new Map(
    evidence.evidence.map((e) => [e.invariantId, e])
  );

  let implementedTested = 0;
  let implementedUntested = 0;
  let specifiedOnly = 0;

  const resolved: ResolvedInvariant[] = tree.invariants.map((inv) => {
    const ev = evidenceMap.get(inv.id);
    let status: InvariantStatus;

    if (ev && ev.implemented && ev.tested) {
      status = "implemented-tested";
      implementedTested++;
    } else if (ev && ev.implemented) {
      status = "implemented-untested";
      implementedUntested++;
    } else {
      status = "specified-only";
      specifiedOnly++;
    }

    return {
      ...inv,
      status,
      codeLocations: ev?.codeLocations ?? [],
      testLocations: ev?.testLocations ?? [],
    };
  });

  // Group by top-level segment of ID
  const groupMap = new Map<string, ResolvedInvariant[]>();
  for (const inv of resolved) {
    const groupName = inv.id.split(".")[0];
    if (!groupMap.has(groupName)) groupMap.set(groupName, []);
    groupMap.get(groupName)!.push(inv);
  }

  const groups = Array.from(groupMap.entries()).map(([name, invariants]) => {
    const total = invariants.length;
    const covered = invariants.filter(
      (i) => i.status === "implemented-tested" || i.status === "implemented-untested"
    ).length;
    return {
      name,
      coverage: total > 0 ? covered / total : 0,
      invariants,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    groups,
    unspecified: evidence.unspecified,
    summary: {
      total: tree.invariants.length,
      implementedTested,
      implementedUntested,
      specifiedOnly,
      unspecified: evidence.unspecified.length,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/invariants/__tests__/compare.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/invariants/compare.ts src/invariants/__tests__/compare.test.ts
git commit -m "feat(invariants): add compare function to merge tree and evidence"
```

---

## Chunk 2: Extraction Scripts (Coordinator-Level)

These scripts are run by the `/octowiki:invariants` skill coordinator. They prepare inputs for Sonnet subagents and write the outputs.

### Task 4: Write the spec extraction coordinator

**Files:**
- Create: `src/invariants/extract-spec.ts`

This script is called by the skill coordinator. It reads wiki pages grouped by category and writes input files for Sonnet subagents. The actual Sonnet calls happen in the skill coordinator (the agent), not in this script.

- [ ] **Step 1: Write the script**

```typescript
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const WIKI_DIR = join(import.meta.dir, "../../wiki/pages");
const INVARIANTS_DIR = join(import.meta.dir, "../../wiki/invariants");

export interface SpecExtractionBatch {
  category: string;
  pages: { slug: string; content: string }[];
}

export function prepareSpecBatches(): SpecExtractionBatch[] {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  const byCategory = new Map<string, { slug: string; content: string }[]>();

  for (const file of files) {
    const content = readFileSync(join(WIKI_DIR, file), "utf-8");
    const slug = file.replace(".md", "");

    // Extract category from frontmatter
    const match = content.match(/^category:\s*(.+)$/m);
    const category = match ? match[1].trim() : "uncategorised";

    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push({ slug, content });
  }

  return Array.from(byCategory.entries()).map(([category, pages]) => ({
    category,
    pages,
  }));
}

export function writeSpecBatches(batches: SpecExtractionBatch[], outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < batches.length; i++) {
    writeFileSync(
      join(outDir, `batch-${i}.json`),
      JSON.stringify(batches[i], null, 2)
    );
  }
  console.log(`Wrote ${batches.length} spec extraction batches to ${outDir}`);
}

if (import.meta.main) {
  const outDir = process.argv[2] || join(INVARIANTS_DIR, "staging");
  const batches = prepareSpecBatches();
  writeSpecBatches(batches, outDir);
  for (const b of batches) {
    console.log(`  ${b.category}: ${b.pages.length} pages`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/invariants/extract-spec.ts
git commit -m "feat(invariants): add spec extraction batch preparation script"
```

### Task 5: Write the evidence extraction coordinator

**Files:**
- Create: `src/invariants/extract-evidence.ts`

Reads `tree.json`, determines which source files are relevant per group, and writes input files for Sonnet subagents.

- [ ] **Step 1: Write the script**

```typescript
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
  "bun-runtime": ["."], // root-level config
  "configuration-env-vars": ["."],
  "loop-prevention": ["wiki", "watcher"],
  "add-page-flow": ["wiki", "server/routes"],
  "tag-auto-apply": ["agents", "wiki"],
  "error-handling": ["server", "agents", "watcher"],
  "testing-strategy": ["."], // meta, no specific dir
};

export interface EvidenceExtractionInput {
  group: string;
  invariants: { id: string; description: string }[];
  sourceFiles: { path: string; content: string }[];
  testFiles: { path: string; content: string }[];
}

function collectFiles(dir: string, ext: string = ".ts"): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
      results.push(...collectFiles(full, ext));
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith(".test.ts")) {
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
```

- [ ] **Step 2: Commit**

```bash
git add src/invariants/extract-evidence.ts
git commit -m "feat(invariants): add evidence extraction input preparation script"
```

### Task 6: Write the output assembly script

**Files:**
- Create: `src/invariants/assemble.ts`

Reads the comparison report and renders wiki pages to `wiki/invariants/`.

- [ ] **Step 1: Write the script**

```typescript
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import type { ComparisonReport } from "./types";
import { renderInvariantPage } from "./render";

const INVARIANTS_DIR = join(import.meta.dir, "../../wiki/invariants");

export function assembleInvariantPages(report: ComparisonReport): void {
  mkdirSync(INVARIANTS_DIR, { recursive: true });

  // Write report.json
  writeFileSync(
    join(INVARIANTS_DIR, "report.json"),
    JSON.stringify(report, null, 2)
  );

  // Render each group as a wiki page
  for (const group of report.groups) {
    const groupUnspecified = report.unspecified.filter((u) =>
      u.codeLocations.some((l) =>
        group.invariants.some((inv) =>
          inv.codeLocations.some((cl) => l.startsWith(cl.split("/").slice(0, -1).join("/")))
        )
      )
    );

    const page = renderInvariantPage(group.name, group.invariants, groupUnspecified);
    writeFileSync(join(INVARIANTS_DIR, `${group.name}.md`), page);
  }

  // Summary
  const s = report.summary;
  console.log(`\nInvariants report:`);
  console.log(`  Total spec invariants: ${s.total}`);
  console.log(`  Implemented + tested:  ${s.implementedTested}`);
  console.log(`  Implemented, untested: ${s.implementedUntested}`);
  console.log(`  Specified only:        ${s.specifiedOnly}`);
  console.log(`  Unspecified (in code):  ${s.unspecified}`);
  console.log(`\nWrote ${report.groups.length} invariant pages to wiki/invariants/`);
}

if (import.meta.main) {
  const reportFile = process.argv[2];
  if (!reportFile) {
    console.error("Usage: bun run src/invariants/assemble.ts <report.json>");
    process.exit(1);
  }
  const report: ComparisonReport = JSON.parse(readFileSync(reportFile, "utf-8"));
  assembleInvariantPages(report);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/invariants/assemble.ts
git commit -m "feat(invariants): add assembly script to render invariant wiki pages"
```

---

## Chunk 3: Skill Definition and Package Scripts

### Task 7: Write the skill definition

**Files:**
- Create: `.claude/skills/octowiki-invariants/SKILL.md`

- [ ] **Step 1: Write the skill file**

The skill orchestrates the three stages using subagents. It calls the preparation scripts, dispatches Sonnet subagents for extraction, and calls the assembly script for output.

The SKILL.md should contain:
- Name and description (triggers on `/octowiki:invariants`)
- Usage: `/octowiki:invariants [--stage 1|2|3] [--group <name>]`
- Step 1: Spec extraction — run `bun run extract-spec` to prepare batches, dispatch Sonnet subagents per batch with the spec extraction prompt, collect results into `tree.json`, run deduplication pass
- Step 2: Evidence extraction — run `bun run extract-evidence` to prepare inputs, dispatch Sonnet subagents per group with the evidence extraction prompt, collect results into `evidence.json`
- Step 3: Comparison — dispatch a single Sonnet subagent with `tree.json` and `evidence.json`, receive `report.json`, run `bun run assemble` to render wiki pages
- Include the full prompts for each Sonnet subagent (spec extraction, evidence extraction, comparison)
- Note that content field in JSON responses should not include frontmatter

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/octowiki-invariants/SKILL.md
git commit -m "feat(invariants): add /octowiki:invariants skill definition"
```

### Task 8: Add package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

Add these scripts to the `scripts` section:

```json
"extract-spec": "bun run src/invariants/extract-spec.ts",
"extract-evidence": "bun run src/invariants/extract-evidence.ts",
"assemble-invariants": "bun run src/invariants/assemble.ts"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(invariants): add package.json scripts for invariant pipeline"
```

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add invariants section**

Add after the "Batch Import" section:

```markdown
## Invariants

To extract and compare invariants between wiki documentation and code, use `/octowiki:invariants`. It runs a three-stage pipeline: spec extraction from wiki pages, evidence extraction from source code and tests, and comparison to surface implementation gaps. Results are written to `wiki/invariants/`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add invariants section to CLAUDE.md"
```
