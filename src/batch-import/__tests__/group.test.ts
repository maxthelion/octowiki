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
