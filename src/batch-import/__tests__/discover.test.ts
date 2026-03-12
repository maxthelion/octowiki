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

    const onDisk = JSON.parse(readFileSync(join(manifest.tmpDir, "manifest.json"), "utf-8"));
    expect(onDisk.files).toHaveLength(1);

    const { existsSync } = require("fs");
    expect(existsSync(join(manifest.tmpDir, "map"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "reduce"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "wiki", "pages"))).toBe(true);
    expect(existsSync(join(manifest.tmpDir, "merges"))).toBe(true);

    rmSync(manifest.tmpDir, { recursive: true, force: true });
  });
});
