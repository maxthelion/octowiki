import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { initWiki } from "../init";

const TEST_DIR = "/tmp/octowiki-test-init";

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("initWiki", () => {
  test("creates wiki directory structure", () => {
    initWiki(TEST_DIR);
    expect(existsSync(join(TEST_DIR, "wiki/pages"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "wiki/.meta/pages"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "wiki/.meta/plans"))).toBe(true);
  });

  test("writes category taxonomy", () => {
    initWiki(TEST_DIR);
    const taxonomy = readFileSync(join(TEST_DIR, "wiki/pages/category-taxonomy.md"), "utf-8");
    expect(taxonomy).toContain("Category Taxonomy");
    expect(taxonomy).toContain("architecture");
  });

  test("initializes queue.json and backlinks.json", () => {
    initWiki(TEST_DIR);
    expect(readFileSync(join(TEST_DIR, "wiki/.meta/queue.json"), "utf-8")).toBe("[]");
    expect(readFileSync(join(TEST_DIR, "wiki/.meta/backlinks.json"), "utf-8")).toBe("{}");
  });

  test("creates CLAUDE.md with octowiki snippet", () => {
    initWiki(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
    expect(content).toContain("<!-- octowiki -->");
    expect(content).toContain("bunx octowiki serve");
  });

  test("appends to existing CLAUDE.md without duplicating", () => {
    writeFileSync(join(TEST_DIR, "CLAUDE.md"), "# Existing\n\nSome content.\n");
    initWiki(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
    expect(content).toContain("# Existing");
    expect(content).toContain("<!-- octowiki -->");
  });

  test("skips CLAUDE.md patch if marker already present", () => {
    writeFileSync(join(TEST_DIR, "CLAUDE.md"), "# Project\n\n<!-- octowiki -->\nalready here\n<!-- /octowiki -->\n");
    initWiki(TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
    const matches = content.match(/<!-- octowiki -->/g);
    expect(matches).toHaveLength(1);
  });

  test("is idempotent — safe to run twice", () => {
    initWiki(TEST_DIR);
    initWiki(TEST_DIR);
    expect(existsSync(join(TEST_DIR, "wiki/pages/category-taxonomy.md"))).toBe(true);
  });
});
