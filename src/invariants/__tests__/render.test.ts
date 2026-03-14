import { test, expect, describe } from "bun:test";
import { renderInvariantPage } from "../render";
import type { ResolvedInvariant, UnspecifiedInvariant } from "../types";

describe("renderInvariantPage", () => {
  test("renders a group with hierarchy and gap table", () => {
    const invariants: ResolvedInvariant[] = [
      {
        id: "test-group.parent",
        parent: null,
        description: "The system does X",
        kind: "behavioural",
        verificationMethod: "integration-test",
        sources: ["system-architecture"],
        status: "implemented-tested",
        codeLocations: ["src/x.ts"],
        testLocations: ["src/__tests__/x.test.ts"],
      },
      {
        id: "test-group.parent.child",
        parent: "test-group.parent",
        description: "Specifically it does Y",
        kind: "architectural",
        verificationMethod: "static-analysis",
        sources: ["system-architecture"],
        status: "specified-only",
        codeLocations: [],
        testLocations: [],
      },
    ];

    const result = renderInvariantPage("test-group", invariants, []);

    // Has frontmatter
    expect(result).toContain("title: Test Group Invariants");
    expect(result).toContain("group: test-group");
    expect(result).toContain("coverage: 50%");

    // Has parent as h2
    expect(result).toContain("## The system does X");
    expect(result).toContain("**Kind:** behavioural");
    expect(result).toContain("**Status:** implemented-tested");

    // Has child as h3
    expect(result).toContain("### Specifically it does Y");
    expect(result).toContain("**Status:** specified-only");

    // Has gaps table
    expect(result).toContain("## Gaps");
    expect(result).toContain("Specifically it does Y");
    expect(result).toContain("specified-only");
  });

  test("no gaps section when fully covered", () => {
    const invariants: ResolvedInvariant[] = [
      {
        id: "full.one",
        parent: null,
        description: "Everything works",
        kind: "behavioural",
        verificationMethod: "unit-test",
        sources: ["skills"],
        status: "implemented-tested",
        codeLocations: ["src/a.ts"],
        testLocations: ["src/__tests__/a.test.ts"],
      },
    ];

    const result = renderInvariantPage("full", invariants, []);
    expect(result).not.toContain("## Gaps");
    expect(result).toContain("coverage: 100%");
  });
});
