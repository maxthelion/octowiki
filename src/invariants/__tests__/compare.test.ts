import { test, expect, describe } from "bun:test";
import { compareTreeAndEvidence } from "../compare";
import type { InvariantTree, EvidenceReport } from "../types";

describe("compareTreeAndEvidence", () => {
  test("merges tree and evidence into resolved invariants with correct statuses", () => {
    const tree: InvariantTree = {
      extractedAt: "2026-03-14",
      invariants: [
        {
          id: "g.tested",
          parent: null,
          description: "Has test",
          kind: "behavioural",
          verificationMethod: "unit-test",
          sources: ["skills"],
        },
        {
          id: "g.untested",
          parent: null,
          description: "No test",
          kind: "behavioural",
          verificationMethod: "unit-test",
          sources: ["skills"],
        },
        {
          id: "g.missing",
          parent: null,
          description: "Not implemented",
          kind: "behavioural",
          verificationMethod: "integration-test",
          sources: ["skills"],
        },
      ],
    };

    const evidence: EvidenceReport = {
      extractedAt: "2026-03-14",
      evidence: [
        {
          invariantId: "g.tested",
          implemented: true,
          tested: true,
          codeLocations: ["src/a.ts"],
          testLocations: ["src/__tests__/a.test.ts"],
        },
        {
          invariantId: "g.untested",
          implemented: true,
          tested: false,
          codeLocations: ["src/b.ts"],
          testLocations: [],
        },
      ],
      unspecified: [
        {
          description: "Extra behaviour",
          codeLocations: ["src/c.ts"],
          testLocations: [],
        },
      ],
    };

    const report = compareTreeAndEvidence(tree, evidence);

    expect(report.summary.total).toBe(3);
    expect(report.summary.implementedTested).toBe(1);
    expect(report.summary.implementedUntested).toBe(1);
    expect(report.summary.specifiedOnly).toBe(1);
    expect(report.summary.unspecified).toBe(1);
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0].name).toBe("g");
    expect(report.groups[0].coverage).toBeCloseTo(0.667, 2);
  });
});
