import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadTaxonomy } from "../taxonomy";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/octowiki-test-taxonomy";

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loadTaxonomy", () => {
  test("parses ### heading categories", () => {
    writeFileSync(
      join(TEST_DIR, "category-taxonomy.md"),
      `---
title: Category Taxonomy
category: meta
---

## Categories

### architecture

**What belongs here:** System structure.

### pipeline

**What belongs here:** Data flow.

### data-model

**What belongs here:** Schemas.

## Usage

Some other content.`
    );
    const result = loadTaxonomy(join(TEST_DIR, "category-taxonomy.md"));
    expect(result.categories).toEqual(["architecture", "pipeline", "data-model"]);
  });

  test("returns empty for missing file", () => {
    const result = loadTaxonomy(join(TEST_DIR, "nonexistent.md"));
    expect(result.categories).toEqual([]);
  });
});
