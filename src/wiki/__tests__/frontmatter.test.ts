import { describe, test, expect } from "bun:test";
import { parseFrontmatter, updateFrontmatter, serializePage } from "../frontmatter";

const SAMPLE_PAGE = `---
title: Road Network
category: pipeline
tags: [road-network, performance]
summary: "Describes road generation algorithm"
last-modified-by: user
---

## Current approach

Some content here.`;

describe("parseFrontmatter", () => {
  test("parses valid frontmatter", () => {
    const result = parseFrontmatter(SAMPLE_PAGE);
    expect(result.data.title).toBe("Road Network");
    expect(result.data.category).toBe("pipeline");
    expect(result.data.tags).toEqual(["road-network", "performance"]);
    expect(result.data["last-modified-by"]).toBe("user");
    expect(result.content).toContain("## Current approach");
  });

  test("returns defaults for missing frontmatter", () => {
    const result = parseFrontmatter("# Just a heading\n\nSome text.");
    expect(result.data.title).toBe("");
    expect(result.data.category).toBe("");
    expect(result.data.tags).toEqual([]);
    expect(result.data["last-modified-by"]).toBe("user");
  });
});

describe("updateFrontmatter", () => {
  test("updates specific fields", () => {
    const updated = updateFrontmatter(SAMPLE_PAGE, {
      tags: ["road-network", "performance", "new-tag"],
      "last-modified-by": "agent",
    });
    const result = parseFrontmatter(updated);
    expect(result.data.tags).toEqual(["road-network", "performance", "new-tag"]);
    expect(result.data["last-modified-by"]).toBe("agent");
    expect(result.data.title).toBe("Road Network");
    expect(result.content).toContain("## Current approach");
  });
});

describe("serializePage", () => {
  test("creates page with frontmatter and content", () => {
    const page = serializePage(
      {
        title: "New Page",
        category: "architecture",
        tags: ["test"],
        summary: "A test page",
        "last-modified-by": "user",
      },
      "## Content\n\nHello world."
    );
    expect(page).toContain("title: New Page");
    expect(page).toContain("## Content");
    expect(page).toContain("Hello world.");
  });
});
