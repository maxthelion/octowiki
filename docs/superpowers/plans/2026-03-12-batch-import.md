# Batch Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code skill that consolidates documentation from a repo into structured wiki pages using a map-reduce architecture with Haiku (extraction) and Sonnet (synthesis).

**Architecture:** A hybrid skill — a Bun discovery script finds and reads markdown files, then the Claude Code skill coordinator orchestrates Haiku subagents (map), deterministic grouping code, Sonnet subagents (reduce), and the add-page skill (create). Everything stages in /tmp before applying to the wiki.

**Tech Stack:** Bun, Anthropic SDK (Haiku 4.5 + Sonnet 4.6 via Claude Code Agent tool), qmd CLI, gray-matter

---

## Chunk 1: Discovery Script and Types

### Task 1: Batch Import Types

**Files:**
- Create: `src/batch-import/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/batch-import/types.ts

export interface ManifestFile {
  path: string;
  relativePath: string;
  lastModified: string; // ISO 8601
  sizeBytes: number;
  content: string;
}

export interface Manifest {
  repoPath: string;
  createdAt: string;
  tmpDir: string;
  files: ManifestFile[];
}

export interface TopicExtract {
  topic: string;
  suggestedSlug: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  confidence: number;
}

export interface ExistingOverlap {
  topic: string;
  existingSlug: string;
  overlapLevel: "high" | "medium" | "low";
  recommendation: "merge_into_existing" | "create_new" | "skip";
}

export interface MapOutput {
  file: string;
  topics: TopicExtract[];
  existingOverlaps: ExistingOverlap[];
  skipped: string;
}

export interface GroupExtract {
  source: string;
  date: string;
  content: string;
  tags: string[];
  confidence: number;
}

export interface NewPageGroup {
  slug: string;
  category: string;
  extracts: GroupExtract[];
  allTags: string[];
}

export interface MergeGroup {
  slug: string;
  existingContent: string;
  extracts: GroupExtract[];
  allTags: string[];
}

export interface SkippedFile {
  source: string;
  reason: string;
}

export interface GroupsOutput {
  newPages: NewPageGroup[];
  mergeIntoExisting: MergeGroup[];
  skipped: SkippedFile[];
}

export interface NewPageReduceOutput {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
}

export interface MergeReduceOutput {
  slug: string;
  action: "update";
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
  changelog: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/batch-import/types.ts
git commit -m "feat(batch-import): add shared types for manifest, map, group, reduce"
```

---

### Task 2: Discovery Script

**Files:**
- Create: `src/batch-import/discover.ts`
- Test: `src/batch-import/__tests__/discover.test.ts`
- Reference: `src/bootstrap.ts` (existing file finder pattern)

- [ ] **Step 1: Write the failing test**

```typescript
// src/batch-import/__tests__/discover.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { discoverFiles, createManifest } from "../discover";

const TMP = join(import.meta.dir, ".tmp-test-discover");

beforeEach(() => {
  mkdirSync(join(TMP, "docs"), { recursive: true });
  mkdirSync(join(TMP, "node_modules"), { recursive: true });
  mkdirSync(join(TMP, ".git"), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("discoverFiles", () => {
  test("finds .md files and reads content", () => {
    writeFileSync(join(TMP, "README.md"), "# Hello");
    writeFileSync(join(TMP, "docs", "guide.md"), "# Guide");

    const files = discoverFiles(TMP);

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath).sort()).toEqual([
      "README.md",
      "docs/guide.md",
    ]);
    expect(files[0].content).toBeTruthy();
    expect(files[0].sizeBytes).toBeGreaterThan(0);
  });

  test("excludes node_modules, .git, dist, wiki dirs", () => {
    writeFileSync(join(TMP, "README.md"), "# Hello");
    writeFileSync(join(TMP, "node_modules", "pkg.md"), "# Pkg");
    writeFileSync(join(TMP, ".git", "info.md"), "# Git");

    const files = discoverFiles(TMP);

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("README.md");
  });

  test("skips files larger than 100KB", () => {
    writeFileSync(join(TMP, "small.md"), "# Small");
    writeFileSync(join(TMP, "big.md"), "x".repeat(101 * 1024));

    const files = discoverFiles(TMP);

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("small.md");
  });

  test("skips empty files", () => {
    writeFileSync(join(TMP, "empty.md"), "");
    writeFileSync(join(TMP, "real.md"), "# Content");

    const files = discoverFiles(TMP);

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("real.md");
  });
});

describe("createManifest", () => {
  test("creates manifest file and subdirectories in temp dir", () => {
    writeFileSync(join(TMP, "README.md"), "# Hello");

    const manifest = createManifest(TMP);

    expect(manifest.files).toHaveLength(1);
    expect(manifest.tmpDir).toContain("octowiki-import-");

    // Verify manifest.json was written
    const onDisk = JSON.parse(readFileSync(join(manifest.tmpDir, "manifest.json"), "utf-8"));
    expect(onDisk.files).toHaveLength(1);

    // Verify subdirectories exist
    const { existsSync } = require("fs");
    expect(existsSync(join(manifest.tmpDir, "map"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "reduce"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "wiki", "pages"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "merges"))).toBe(true);

    // Cleanup temp dir
    rmSync(manifest.tmpDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/batch-import/__tests__/discover.test.ts`
Expected: FAIL — `discoverFiles` does not exist

- [ ] **Step 3: Write the discovery module**

```typescript
// src/batch-import/discover.ts
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
  // Fallback to filesystem mtime
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

  // Create subdirectories for later phases
  mkdirSync(join(tmpDir, "map"), { recursive: true });
  mkdirSync(join(tmpDir, "reduce"), { recursive: true });
  mkdirSync(join(tmpDir, "wiki", "pages"), { recursive: true });
  mkdirSync(join(tmpDir, "merges"), { recursive: true });

  writeFileSync(join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return manifest;
}

// CLI entry point
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/batch-import/__tests__/discover.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/batch-import/discover.ts src/batch-import/__tests__/discover.test.ts
git commit -m "feat(batch-import): discovery script finds and catalogs markdown files"
```

---

### Task 3: Grouping Logic

**Files:**
- Create: `src/batch-import/group.ts`
- Test: `src/batch-import/__tests__/group.test.ts`
- Reference: `src/batch-import/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/batch-import/__tests__/group.test.ts
import { test, expect, describe } from "bun:test";
import { groupMapOutputs } from "../group";
import type { MapOutput } from "../types";

describe("groupMapOutputs", () => {
  test("groups topics with the same slug into one newPage", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "docs/auth.md",
        topics: [{
          topic: "authentication",
          suggestedSlug: "authentication",
          category: "architecture",
          summary: "OAuth2 flow",
          content: "OAuth2 details...",
          tags: ["auth", "oauth2"],
          confidence: 0.9,
        }],
        existingOverlaps: [],
        skipped: "",
      },
      {
        file: "README.md",
        topics: [{
          topic: "authentication",
          suggestedSlug: "authentication",
          category: "architecture",
          summary: "Auth setup",
          content: "Auth setup guide...",
          tags: ["auth", "setup"],
          confidence: 0.7,
        }],
        existingOverlaps: [],
        skipped: "",
      },
    ];

    const fileDates: Record<string, string> = {
      "docs/auth.md": "2026-03-01T00:00:00Z",
      "README.md": "2026-01-15T00:00:00Z",
    };

    const groups = groupMapOutputs(mapOutputs, {}, fileDates);
    expect(groups.newPages).toHaveLength(1);
    expect(groups.newPages[0].slug).toBe("authentication");
    expect(groups.newPages[0].extracts).toHaveLength(2);
    // Recency: most recent extract first
    expect(groups.newPages[0].extracts[0].source).toBe("docs/auth.md");
    expect(groups.newPages[0].allTags).toContain("auth");
    expect(groups.newPages[0].allTags).toContain("oauth2");
    expect(groups.newPages[0].allTags).toContain("setup");
  });

  test("skips topics with recommendation 'skip'", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "docs/old.md",
        topics: [{
          topic: "legacy-auth",
          suggestedSlug: "authentication",
          category: "architecture",
          summary: "Old auth docs",
          content: "...",
          tags: ["auth"],
          confidence: 0.8,
        }],
        existingOverlaps: [{
          topic: "legacy-auth",
          existingSlug: "authentication",
          overlapLevel: "high",
          recommendation: "skip",
        }],
        skipped: "",
      },
    ];

    const groups = groupMapOutputs(mapOutputs, {});
    expect(groups.newPages).toHaveLength(0);
    expect(groups.mergeIntoExisting).toHaveLength(0);
    expect(groups.skipped).toHaveLength(1);
    expect(groups.skipped[0].reason).toContain("skip");
  });

  test("routes merge_into_existing to mergeIntoExisting group", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "docs/auth.md",
        topics: [{
          topic: "authentication",
          suggestedSlug: "authentication",
          category: "architecture",
          summary: "New auth info",
          content: "New content...",
          tags: ["auth"],
          confidence: 0.8,
        }],
        existingOverlaps: [{
          topic: "authentication",
          existingSlug: "authentication",
          overlapLevel: "high",
          recommendation: "merge_into_existing",
        }],
        skipped: "",
      },
    ];

    const existingPages: Record<string, string> = {
      authentication: "# Authentication\n\nExisting content...",
    };

    const groups = groupMapOutputs(mapOutputs, existingPages);
    expect(groups.newPages).toHaveLength(0);
    expect(groups.mergeIntoExisting).toHaveLength(1);
    expect(groups.mergeIntoExisting[0].slug).toBe("authentication");
    expect(groups.mergeIntoExisting[0].existingContent).toBe(existingPages.authentication);
  });

  test("drops low-confidence extracts below threshold", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "misc.md",
        topics: [{
          topic: "trivial",
          suggestedSlug: "trivial",
          category: "meta",
          summary: "Low quality",
          content: "...",
          tags: [],
          confidence: 0.2,
        }],
        existingOverlaps: [],
        skipped: "",
      },
    ];

    const groups = groupMapOutputs(mapOutputs, {});
    expect(groups.newPages).toHaveLength(0);
    expect(groups.skipped).toHaveLength(1);
    expect(groups.skipped[0].reason).toContain("confidence");
  });

  test("uses highest-confidence category when slugs conflict", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "a.md",
        topics: [{
          topic: "deploy",
          suggestedSlug: "deployment",
          category: "pipeline",
          summary: "Deploy pipeline",
          content: "...",
          tags: ["deploy"],
          confidence: 0.6,
        }],
        existingOverlaps: [],
        skipped: "",
      },
      {
        file: "b.md",
        topics: [{
          topic: "deploy",
          suggestedSlug: "deployment",
          category: "architecture",
          summary: "Deploy arch",
          content: "...",
          tags: ["deploy"],
          confidence: 0.9,
        }],
        existingOverlaps: [],
        skipped: "",
      },
    ];

    const groups = groupMapOutputs(mapOutputs, {});
    expect(groups.newPages[0].category).toBe("architecture");
  });

  test("collects skipped files from map outputs", () => {
    const mapOutputs: MapOutput[] = [
      {
        file: "CHANGELOG.md",
        topics: [],
        existingOverlaps: [],
        skipped: "Not wiki-worthy",
      },
    ];

    const groups = groupMapOutputs(mapOutputs, {});
    expect(groups.skipped).toHaveLength(1);
    expect(groups.skipped[0].source).toBe("CHANGELOG.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/batch-import/__tests__/group.test.ts`
Expected: FAIL — `groupMapOutputs` does not exist

- [ ] **Step 3: Write the grouping module**

```typescript
// src/batch-import/group.ts
import type {
  MapOutput,
  GroupExtract,
  GroupsOutput,
  NewPageGroup,
  MergeGroup,
  SkippedFile,
} from "./types";

const CONFIDENCE_THRESHOLD = 0.3;

export function groupMapOutputs(
  mapOutputs: MapOutput[],
  existingPages: Record<string, string>, // slug -> raw content
  fileDates: Record<string, string> = {} // file path -> ISO date from manifest
): GroupsOutput {
  const slugBuckets = new Map<string, {
    extracts: GroupExtract[];
    allTags: string[];
    bestCategory: string;
    bestConfidence: number;
    isMerge: boolean;
  }>();
  const skipped: SkippedFile[] = [];

  for (const output of mapOutputs) {
    // Collect file-level skips
    if (output.topics.length === 0 && output.skipped) {
      skipped.push({ source: output.file, reason: output.skipped });
      continue;
    }

    // Build sets of slugs flagged for merge or skip
    const mergeSlugs = new Set(
      output.existingOverlaps
        .filter((o) => o.recommendation === "merge_into_existing")
        .map((o) => o.existingSlug)
    );
    const skipSlugs = new Set(
      output.existingOverlaps
        .filter((o) => o.recommendation === "skip")
        .map((o) => o.existingSlug)
    );

    for (const topic of output.topics) {
      // Drop topics flagged to skip
      if (skipSlugs.has(topic.suggestedSlug)) {
        skipped.push({
          source: output.file,
          reason: `Overlap with existing "${topic.suggestedSlug}" — recommended skip`,
        });
        continue;
      }
      // Drop low confidence
      if (topic.confidence < CONFIDENCE_THRESHOLD) {
        skipped.push({
          source: output.file,
          reason: `Low confidence (${topic.confidence}) for topic "${topic.topic}"`,
        });
        continue;
      }

      const slug = topic.suggestedSlug;
      const isMerge = mergeSlugs.has(slug) || slug in existingPages;

      if (!slugBuckets.has(slug)) {
        slugBuckets.set(slug, {
          extracts: [],
          allTags: [],
          bestCategory: topic.category,
          bestConfidence: topic.confidence,
          isMerge,
        });
      }

      const bucket = slugBuckets.get(slug)!;
      bucket.extracts.push({
        source: output.file,
        date: fileDates[output.file] ?? "",
        content: topic.content,
        tags: topic.tags,
        confidence: topic.confidence,
      });

      // Merge tags (deduplicated)
      for (const tag of topic.tags) {
        if (!bucket.allTags.includes(tag)) {
          bucket.allTags.push(tag);
        }
      }

      // Highest confidence wins category
      if (topic.confidence > bucket.bestConfidence) {
        bucket.bestCategory = topic.category;
        bucket.bestConfidence = topic.confidence;
      }

      // If any overlap says merge, the whole bucket is a merge
      if (isMerge) bucket.isMerge = true;
    }
  }

  const newPages: NewPageGroup[] = [];
  const mergeIntoExisting: MergeGroup[] = [];

  for (const [slug, bucket] of slugBuckets) {
    // Sort extracts by date descending (recency bias)
    bucket.extracts.sort((a, b) => b.date.localeCompare(a.date));

    if (bucket.isMerge) {
      mergeIntoExisting.push({
        slug,
        existingContent: existingPages[slug] ?? "",
        extracts: bucket.extracts,
        allTags: bucket.allTags,
      });
    } else {
      newPages.push({
        slug,
        category: bucket.bestCategory,
        extracts: bucket.extracts,
        allTags: bucket.allTags,
      });
    }
  }

  return { newPages, mergeIntoExisting, skipped };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/batch-import/__tests__/group.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/batch-import/group.ts src/batch-import/__tests__/group.test.ts
git commit -m "feat(batch-import): deterministic grouping of map outputs by topic"
```

---

## Chunk 2: Skill and Prompts

### Task 4: Batch Import Skill

**Files:**
- Create: `.claude/skills/octowiki-batch-import/SKILL.md`
- Reference: `.claude/skills/octowiki-add-page/SKILL.md` (existing skill pattern)
- Reference: `docs/superpowers/specs/2026-03-12-batch-import-design.md` (the spec)
- Reference: `wiki/pages/category-taxonomy.md` (categories)
- Reference: `wiki/pages/content-guidelines.md` (content rules)

- [ ] **Step 1: Write the skill file**

```markdown
---
name: octowiki-batch-import
description: Use when importing or consolidating documentation from a repo into the wiki. Triggered by /octowiki:batch-import. Use when the user wants to bootstrap, import, or batch-create wiki pages from existing markdown files.
---

# Batch Import

Import and consolidate documentation from a repository into structured wiki pages using a map-reduce pipeline.

## Usage

```
/octowiki:batch-import <repo-path> [--dry-run] [--force]
```

- `<repo-path>` — path to the repo to import from (defaults to cwd)
- `--dry-run` — stop after preview, don't apply to wiki
- `--force` — proceed even if >200 files found

## Process

### Step 1: Discover

Run the discovery script to find all markdown files and create a manifest:

```bash
bun run src/batch-import/discover.ts <repo-path>
```

This creates `/tmp/octowiki-import-XXXX/manifest.json` with all discovered files, their git dates, and content. Read the manifest to get the file list and temp directory path.

If the manifest has >200 files and `--force` was not passed, stop and ask the user to confirm.

### Step 2: Index

Ensure the wiki's search index is current (skip if qmd is not available):

```bash
qmd update --collection wiki/.index/qmd
qmd embed --collection wiki/.index/qmd
```

### Step 3: Map (Haiku subagents)

For each file in the manifest, dispatch a Haiku subagent (parallel, batches of 10).

Before dispatching, for each file:
1. Read `wiki/pages/category-taxonomy.md`
2. List existing wiki page slugs: `ls wiki/pages/`
3. Run a qmd search for the file's title/first heading to check for existing coverage:
   `qmd search "<title>" --json --collection wiki/.index/qmd`

**Map subagent prompt:**

> You are extracting structured topic summaries from a documentation file for a wiki.
>
> **File:** {relativePath} (last modified: {lastModified})
>
> **File content:**
> ```
> {content}
> ```
>
> **Category taxonomy:**
> ```
> {category-taxonomy.md content}
> ```
>
> **Existing wiki pages:** {comma-separated list of slugs}
>
> **Search results for existing coverage:**
> ```
> {qmd search results}
> ```
>
> Extract wiki-worthy topics from this file. For each topic, provide:
> - `topic`: short name
> - `suggestedSlug`: kebab-case, max 60 chars
> - `category`: one category from the taxonomy (match against descriptions)
> - `summary`: one sentence
> - `content`: the extracted content, lightly restructured for a wiki reader
> - `tags`: 2-5 relevant tags
> - `confidence`: 0.0-1.0 (how wiki-worthy is this topic?)
>
> Also check for overlaps with existing wiki pages. If a topic substantially overlaps an existing page, flag it in `existingOverlaps` with recommendation `merge_into_existing`.
>
> Skip boilerplate: changelogs, license blocks, badges, contribution guidelines, empty sections. Note what you skipped in the `skipped` field.
>
> A single file may produce multiple topics (e.g. a long README covering several subjects). Only extract topics that would make meaningful wiki pages.
>
> Respond with JSON only:
> ```json
> {
>   "file": "<relativePath>",
>   "topics": [...],
>   "existingOverlaps": [...],
>   "skipped": "<what was skipped and why>"
> }
> ```

Use model override `haiku` for these subagents.

**JSON parsing:** The subagent response may be wrapped in markdown code fences. Strip leading/trailing whitespace, remove ````json` and ```` ``` ````  fences if present, then `JSON.parse()`. If parsing fails or required fields (`file`, `topics`) are missing, that's a retryable failure. Retry up to 3 times. On permanent failure (3 consecutive parse/call failures), record the file in skipped with the error.

Write each result to `/tmp/.../map/<filename>.json`.

### Step 4: Group

Run the grouping script. Read all map output JSON files, read existing wiki page content for any pages flagged as merge targets, then call the grouping function:

```typescript
import { groupMapOutputs } from "./src/batch-import/group";

// Read all map outputs from /tmp/.../map/*.json
// Read existing page content for merge targets
// Call groupMapOutputs(mapOutputs, existingPages)
// Write result to /tmp/.../groups.json
```

The coordinator should do this inline (it's deterministic code, not an LLM call). Write `groups.json` to the temp directory.

### Step 5: Reduce (Sonnet subagents)

For each group, dispatch a Sonnet subagent. Two prompt variants:

**New page reduce prompt:**

> You are synthesising multiple documentation extracts into a single, coherent wiki page.
>
> **Target slug:** {slug}
> **Target category:** {category}
> **Available tags:** {allTags}
>
> **Category guidelines (from taxonomy):**
> ```
> {guidelines for this category from category-taxonomy.md}
> ```
>
> **Content guidelines:**
> ```
> {content-guidelines.md content}
> ```
>
> **Extracts (ordered by recency, most recent first):**
> {for each extract:}
> --- Source: {source} (date: {date}) ---
> {content}
>
> **Related existing wiki pages (for cross-referencing):**
> {qmd search results}
>
> Merge these extracts into a single wiki page. Rules:
> - Follow the category's "pages should contain" guidelines
> - Prefer content from more recent sources when there's conflict
> - Use `[[wikilinks]]` to cross-reference related pages — don't duplicate content
> - Select 2-5 tags from the available tags
> - Write a one-sentence summary
> - Structure with headings, lists, and sections
> - Be concise — distill, don't copy
>
> Respond with JSON only:
> ```json
> {
>   "slug": "<slug>",
>   "title": "<title>",
>   "category": "<category>",
>   "tags": [...],
>   "summary": "<one sentence>",
>   "content": "<markdown content>"
> }
> ```

**Merge reduce prompt:**

> You are incorporating new information into an existing wiki page.
>
> **Existing page ({slug}):**
> ```
> {existing page raw content including frontmatter}
> ```
>
> **New extracts to incorporate:**
> {for each extract:}
> --- Source: {source} (date: {date}) ---
> {content}
>
> **Content guidelines:**
> ```
> {content-guidelines.md content}
> ```
>
> Weave the new information into the existing page. Rules:
> - Preserve the existing page's structure and voice
> - Add new information where it fits naturally
> - If new info conflicts with existing, prefer more recent (check dates)
> - Don't duplicate — if the page already says it, don't add it again
> - Use `[[wikilinks]]` for cross-references
> - Update tags and summary if warranted
>
> Respond with JSON only:
> ```json
> {
>   "slug": "<slug>",
>   "action": "update",
>   "title": "<title>",
>   "category": "<category>",
>   "tags": [...],
>   "summary": "<summary>",
>   "content": "<full updated markdown content>",
>   "changelog": "<one line describing what changed>"
> }
> ```

Use model override `sonnet` for reduce subagents. On failure, retry up to 3 times. On permanent failure, add to skipped.

Write results to `/tmp/.../reduce/<slug>.json`.

### Step 6: Create

For each reduce output:

**New pages:** Use the `/octowiki:add-page` skill logic — but write to `/tmp/.../wiki/pages/` instead of the real wiki. After writing, patch `last-modified-by` to `agent` in the frontmatter (add-page defaults to `user`).

Check for slug collisions:
- Against other staged pages in `/tmp/.../wiki/pages/`
- Against existing pages in `wiki/pages/`
- If collision, append a number (e.g. `auth-2`)

**Merges:** Write the updated content to `/tmp/.../wiki/pages/<slug>.md`. Also generate a diff:
```bash
diff wiki/pages/<slug>.md /tmp/.../wiki/pages/<slug>.md > /tmp/.../merges/<slug>.diff
```

### Step 7: Preview

Output a summary:

```
Batch import complete. Staged in /tmp/octowiki-import-XXXX/

  New pages (N):
    category/slug — summary
    ...

  Merged into existing (N):
    slug — changelog line
    ...

  Skipped (N):
    source — reason
    ...

  Preview: /tmp/octowiki-import-XXXX/wiki/pages/
```

If `--dry-run`: stop here and tell the user the temp dir persists for browsing.

Otherwise, ask: "Apply to wiki? (y/n)"

### Step 8: Apply

On confirmation:
1. Copy all files from `/tmp/.../wiki/pages/` to `wiki/pages/`
2. Run `qmd update` + `qmd embed` to refresh the index
3. Report: "Applied N new pages and M merges to wiki/pages/"
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/octowiki-batch-import/SKILL.md
git commit -m "feat(batch-import): add batch-import skill with map-reduce prompts"
```

---

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add batch import reference to CLAUDE.md**

Add after the Wiki Pages section:

```markdown
## Batch Import

To import documentation from a repo into the wiki, use `/octowiki:batch-import`. It discovers markdown files, extracts topics with Haiku, groups and deduplicates them, synthesises pages with Sonnet, and stages everything in /tmp for preview before applying.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add batch-import skill reference to CLAUDE.md"
```

---

### Task 6: Update Wiki Bootstrapping Page

**Files:**
- Modify: `wiki/pages/bootstrapping.md`

- [ ] **Step 1: Update bootstrapping page to reference the new skill**

Replace the "Current State" section in `wiki/pages/bootstrapping.md` with:

```markdown
## Current State

The batch import system (`/octowiki:batch-import` skill) implements both stages using a map-reduce architecture:

1. **Discover** — a Bun script (`src/batch-import/discover.ts`) finds markdown files and creates a manifest with git dates
2. **Map** — Haiku subagents extract structured topic summaries from each file, checking for duplicates via qmd search
3. **Group** — deterministic code merges extracts by topic, resolving category conflicts and filtering low-confidence results
4. **Reduce** — Sonnet subagents synthesise grouped extracts into coherent wiki pages following [[content-guidelines]]
5. **Create** — pages are written via the [[skills|add-page skill]] to a staging directory for preview before applying

Everything stages in `/tmp/` — nothing touches the wiki until the user confirms.

Usage: `/octowiki:batch-import <repo-path> [--dry-run] [--force]`
```

- [ ] **Step 2: Commit**

```bash
git add wiki/pages/bootstrapping.md
git commit -m "docs: update bootstrapping wiki page to reference batch-import skill"
```

---

### Task 7: Add package.json script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add discover script to package.json**

Add to the `scripts` section:

```json
"discover": "bun run src/batch-import/discover.ts"
```

This allows standalone usage: `bun run discover /path/to/repo`

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat(batch-import): add discover script to package.json"
```

---

### Task 8: Integration Test

**Files:**
- Create: `src/batch-import/__tests__/integration.test.ts`
- Reference: `src/batch-import/discover.ts`, `src/batch-import/group.ts`, `src/batch-import/types.ts`

- [ ] **Step 1: Write integration test for discover → group pipeline**

```typescript
// src/batch-import/__tests__/integration.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { discoverFiles } from "../discover";
import { groupMapOutputs } from "../group";
import type { MapOutput } from "../types";

const TMP = join(import.meta.dir, ".tmp-test-integration");

beforeEach(() => {
  mkdirSync(join(TMP, "docs"), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("discover → group pipeline", () => {
  test("discovered files can be grouped after simulated map", () => {
    // Set up test repo
    writeFileSync(join(TMP, "README.md"), "# My Project\n\nA great project.");
    writeFileSync(join(TMP, "docs", "auth.md"), "# Auth\n\nOAuth2 flow details.");
    writeFileSync(join(TMP, "docs", "deploy.md"), "# Deployment\n\nDocker setup.");

    // Discover
    const files = discoverFiles(TMP);
    expect(files).toHaveLength(3);

    // Simulate map outputs (these would come from Haiku in real use)
    const mapOutputs: MapOutput[] = [
      {
        file: "README.md",
        topics: [
          {
            topic: "project-overview",
            suggestedSlug: "project-overview",
            category: "architecture",
            summary: "Project overview",
            content: "A great project.",
            tags: ["overview"],
            confidence: 0.8,
          },
          {
            topic: "authentication",
            suggestedSlug: "authentication",
            category: "architecture",
            summary: "Brief auth mention",
            content: "Uses OAuth2.",
            tags: ["auth"],
            confidence: 0.5,
          },
        ],
        existingOverlaps: [],
        skipped: "",
      },
      {
        file: "docs/auth.md",
        topics: [{
          topic: "authentication",
          suggestedSlug: "authentication",
          category: "architecture",
          summary: "Full auth docs",
          content: "OAuth2 flow details.",
          tags: ["auth", "oauth2"],
          confidence: 0.9,
        }],
        existingOverlaps: [],
        skipped: "",
      },
      {
        file: "docs/deploy.md",
        topics: [{
          topic: "deployment",
          suggestedSlug: "deployment",
          category: "pipeline",
          summary: "Docker deployment",
          content: "Docker setup.",
          tags: ["deploy", "docker"],
          confidence: 0.85,
        }],
        existingOverlaps: [],
        skipped: "",
      },
    ];

    // Group
    const groups = groupMapOutputs(mapOutputs, {});

    expect(groups.newPages).toHaveLength(3);
    // authentication should have 2 extracts merged
    const authGroup = groups.newPages.find((g) => g.slug === "authentication");
    expect(authGroup).toBeDefined();
    expect(authGroup!.extracts).toHaveLength(2);
    expect(authGroup!.allTags).toContain("oauth2");
  });
});
```

- [ ] **Step 2: Run all batch-import tests**

Run: `bun test src/batch-import/`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/batch-import/__tests__/integration.test.ts
git commit -m "test(batch-import): add integration test for discover → group pipeline"
```

---

## Deferred

- **Resumability** — the spec mentions the batch is "designed to be resumable" via persistent temp dir artifacts. For v1, a failed run must be re-run from scratch. Resumability (detecting prior map outputs, skipping completed phases) is a future enhancement.
