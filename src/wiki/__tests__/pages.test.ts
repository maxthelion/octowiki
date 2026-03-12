import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readPage, writePage, listPages } from "../pages";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_WIKI = "/tmp/octowiki-test-pages";
const PAGES_DIR = join(TEST_WIKI, "pages");
const META_DIR = join(TEST_WIKI, ".meta/pages");

beforeEach(() => {
  mkdirSync(PAGES_DIR, { recursive: true });
  mkdirSync(META_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_WIKI, { recursive: true, force: true });
});

describe("readPage", () => {
  test("reads a page with frontmatter", () => {
    writeFileSync(
      join(PAGES_DIR, "test-page.md"),
      `---
title: Test Page
category: architecture
tags: [test]
summary: "A test"
last-modified-by: user
---

## Content

Hello.`
    );
    const page = readPage(PAGES_DIR, "test-page");
    expect(page).not.toBeNull();
    expect(page!.slug).toBe("test-page");
    expect(page!.title).toBe("Test Page");
    expect(page!.category).toBe("architecture");
    expect(page!.content).toContain("## Content");
  });

  test("returns null for missing page", () => {
    const page = readPage(PAGES_DIR, "nonexistent");
    expect(page).toBeNull();
  });
});

describe("writePage", () => {
  test("writes page to disk", () => {
    writePage(PAGES_DIR, "new-page", {
      title: "New Page",
      category: "meta",
      tags: [],
      summary: "",
      "last-modified-by": "user",
    }, "## Hello\n\nWorld.");

    const page = readPage(PAGES_DIR, "new-page");
    expect(page).not.toBeNull();
    expect(page!.title).toBe("New Page");
    expect(page!.content).toContain("World.");
  });
});

describe("listPages", () => {
  test("lists all pages with summaries", () => {
    writePage(PAGES_DIR, "page-a", {
      title: "Page A", category: "arch", tags: [], summary: "First",
      "last-modified-by": "user",
    }, "Content A");
    writePage(PAGES_DIR, "page-b", {
      title: "Page B", category: "pipe", tags: ["x"], summary: "Second",
      "last-modified-by": "user",
    }, "Content B");

    const pages = listPages(PAGES_DIR);
    expect(pages).toHaveLength(2);
    const slugs = pages.map((p) => p.slug).sort();
    expect(slugs).toEqual(["page-a", "page-b"]);
  });
});
