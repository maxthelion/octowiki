import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { apply } from "../apply";

const TEST_DIR = "/tmp/octowiki-test-apply";
const WIKI_DIR = join(TEST_DIR, "wiki/pages");
const BACKUP_DIR = join(TEST_DIR, "wiki/pages-pre-import");
const REDUCE_DIR = join(TEST_DIR, "reduce");

beforeEach(() => {
  mkdirSync(WIKI_DIR, { recursive: true });
  mkdirSync(REDUCE_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("apply with custom wikiDir", () => {
  test("writes pages to specified wikiDir", () => {
    writeFileSync(join(REDUCE_DIR, "test-page.json"), JSON.stringify({
      slug: "test-page",
      title: "Test Page",
      category: "architecture",
      tags: ["test"],
      summary: "A test page",
      content: "## Hello\n\nWorld.",
    }));

    apply(REDUCE_DIR, WIKI_DIR, BACKUP_DIR);

    expect(existsSync(join(WIKI_DIR, "test-page.md"))).toBe(true);
    const content = readFileSync(join(WIKI_DIR, "test-page.md"), "utf-8");
    expect(content).toContain("title: Test Page");
    expect(content).toContain("Hello");
  });
});
