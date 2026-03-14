import type {
  InvariantTree,
  EvidenceReport,
  ComparisonReport,
  ResolvedInvariant,
  InvariantStatus,
} from "./types";

export function compareTreeAndEvidence(
  tree: InvariantTree,
  evidence: EvidenceReport
): ComparisonReport {
  const evidenceMap = new Map(
    evidence.evidence.map((e) => [e.invariantId, e])
  );

  let implementedTested = 0;
  let implementedUntested = 0;
  let specifiedOnly = 0;

  const resolved: ResolvedInvariant[] = tree.invariants.map((inv) => {
    const ev = evidenceMap.get(inv.id);
    let status: InvariantStatus;

    if (ev && ev.implemented && ev.tested) {
      status = "implemented-tested";
      implementedTested++;
    } else if (ev && ev.implemented) {
      status = "implemented-untested";
      implementedUntested++;
    } else {
      status = "specified-only";
      specifiedOnly++;
    }

    return {
      ...inv,
      status,
      codeLocations: ev?.codeLocations ?? [],
      testLocations: ev?.testLocations ?? [],
    };
  });

  // Group by top-level segment of ID
  const groupMap = new Map<string, ResolvedInvariant[]>();
  for (const inv of resolved) {
    const groupName = inv.id.split(".")[0];
    if (!groupMap.has(groupName)) groupMap.set(groupName, []);
    groupMap.get(groupName)!.push(inv);
  }

  const groups = Array.from(groupMap.entries()).map(([name, invariants]) => {
    const total = invariants.length;
    const covered = invariants.filter(
      (i) => i.status === "implemented-tested" || i.status === "implemented-untested"
    ).length;
    return {
      name,
      coverage: total > 0 ? covered / total : 0,
      invariants,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    groups,
    unspecified: evidence.unspecified,
    summary: {
      total: tree.invariants.length,
      implementedTested,
      implementedUntested,
      specifiedOnly,
      unspecified: evidence.unspecified.length,
    },
  };
}
