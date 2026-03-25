import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createApp } from "../app";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_WIKI = "/tmp/octowiki-test-server";

beforeEach(() => {
  mkdirSync(join(TEST_WIKI, "pages"), { recursive: true });
  mkdirSync(join(TEST_WIKI, ".meta/pages"), { recursive: true });
  mkdirSync(join(TEST_WIKI, ".meta/plans"), { recursive: true });
  mkdirSync(join(TEST_WIKI, "meta"), { recursive: true });

  writeFileSync(
    join(TEST_WIKI, "pages/test-page.md"),
    `---
title: Test Page
category: architecture
tags: [test]
summary: "A test page"
last-modified-by: user
---

## Content

Hello world.`
  );
});

afterEach(() => {
  rmSync(TEST_WIKI, { recursive: true, force: true });
});

describe("GET /api/pages", () => {
  test("returns page summaries", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].slug).toBe("test-page");
    expect(data[0].content).toBeUndefined();
  });
});

describe("GET /api/pages/:slug", () => {
  test("returns full page", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages/test-page");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Test Page");
    expect(data.content).toContain("Hello world.");
  });

  test("returns 404 for missing page", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/pages", () => {
  test("creates a new page", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "My New Page\n\nSome content here." }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.slug).toBeTruthy();
  });
});

describe("GET /api/pages with parent/overview", () => {
  test("returns parent and overview in page summaries", async () => {
    writeFileSync(
      join(TEST_WIKI, "pages/child-page.md"),
      `---
title: Child Page
category: architecture
parent: test-page
overview: true
tags: []
summary: ""
last-modified-by: user
---

## Content`
    );
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages");
    const data = await res.json();
    const child = data.find((p: any) => p.slug === "child-page");
    expect(child).toBeDefined();
    expect(child.parent).toBe("test-page");
    expect(child.overview).toBe(true);
  });

  test("omits parent for pages without one", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages");
    const data = await res.json();
    const page = data.find((p: any) => p.slug === "test-page");
    expect(page.parent).toBeUndefined();
    expect(page.overview).toBe(false);
  });
});
