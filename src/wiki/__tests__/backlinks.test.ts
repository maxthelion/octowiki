import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { computeBacklinks, loadBacklinks, saveBacklinks } from "../backlinks";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/octowiki-test-backlinks";
const PAGES_DIR = join(TEST_DIR, "pages");
const META_DIR = join(TEST_DIR, ".meta");

beforeEach(() => {
  mkdirSync(PAGES_DIR, { recursive: true });
  mkdirSync(META_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("computeBacklinks", () => {
  test("computes backlinks from wikilinks", () => {
    writeFileSync(
      join(PAGES_DIR, "page-a.md"),
      `---
title: A
category: arch
tags: []
summary: ""
last-modified-by: user
---

See [[page-b]] and [[page-c]].`
    );
    writeFileSync(
      join(PAGES_DIR, "page-b.md"),
      `---
title: B
category: arch
tags: []
summary: ""
last-modified-by: user
---

Links to [[page-a]].`
    );

    const backlinks = computeBacklinks(PAGES_DIR);
    expect(backlinks["page-b"]).toContain("page-a");
    expect(backlinks["page-c"]).toContain("page-a");
    expect(backlinks["page-a"]).toContain("page-b");
  });
});

describe("saveBacklinks / loadBacklinks", () => {
  test("round-trips through JSON file", () => {
    const bl = { "page-a": ["page-b"], "page-b": ["page-a"] };
    const filePath = join(META_DIR, "backlinks.json");
    saveBacklinks(filePath, bl);
    const loaded = loadBacklinks(filePath);
    expect(loaded).toEqual(bl);
  });
});
