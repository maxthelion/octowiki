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
    writeFileSync(join(TMP, "README.md"), "# My Project\n\nA great project.");
    writeFileSync(join(TMP, "docs", "auth.md"), "# Auth\n\nOAuth2 flow details.");
    writeFileSync(join(TMP, "docs", "deploy.md"), "# Deployment\n\nDocker setup.");

    const files = discoverFiles(TMP);
    expect(files).toHaveLength(3);

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

    const groups = groupMapOutputs(mapOutputs, {});

    expect(groups.newPages).toHaveLength(3);
    const authGroup = groups.newPages.find((g) => g.slug === "authentication");
    expect(authGroup).toBeDefined();
    expect(authGroup!.extracts).toHaveLength(2);
    expect(authGroup!.allTags).toContain("oauth2");
  });
});
