import type { ResolvedInvariant, UnspecifiedInvariant } from "./types";

export function renderInvariantPage(
  groupName: string,
  invariants: ResolvedInvariant[],
  unspecified: UnspecifiedInvariant[]
): string {
  const title = groupName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const total = invariants.length;
  const covered = invariants.filter(
    (i) => i.status === "implemented-tested" || i.status === "implemented-untested"
  ).length;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const lines: string[] = [
    "---",
    `title: ${title} Invariants`,
    `group: ${groupName}`,
    `generated: ${new Date().toISOString().split("T")[0]}`,
    `coverage: ${coveragePct}%`,
    "---",
    "",
  ];

  // Build hierarchy: roots first, then children
  const roots = invariants.filter((i) => i.parent === null);
  const childrenOf = (parentId: string) =>
    invariants.filter((i) => i.parent === parentId);

  function renderNode(node: ResolvedInvariant, depth: number): void {
    const heading = "#".repeat(depth + 2); // h2 for roots, h3 for children, etc.
    lines.push(`${heading} ${node.description}`);
    lines.push("");
    lines.push(
      `**Kind:** ${node.kind} | **Status:** ${node.status}`
    );
    lines.push(`**Verification:** ${node.verificationMethod} | **Source:** ${node.sources.map((s) => `[[${s}]]`).join(", ")}`);

    if (node.codeLocations.length > 0) {
      lines.push(
        `**Evidence:** ${node.codeLocations.map((l) => "`" + l + "`").join(", ")}`
      );
    }
    if (node.testLocations.length > 0) {
      lines.push(
        `**Tests:** ${node.testLocations.map((l) => "`" + l + "`").join(", ")}`
      );
    }

    lines.push("");

    for (const child of childrenOf(node.id)) {
      renderNode(child, depth + 1);
    }
  }

  for (const root of roots) {
    renderNode(root, 0);
  }

  // Gaps section
  const gaps = invariants.filter(
    (i) => i.status === "specified-only" || i.status === "implemented-untested"
  );
  if (gaps.length > 0 || unspecified.length > 0) {
    lines.push("## Gaps");
    lines.push("");
    lines.push("| Invariant | Status | Notes |");
    lines.push("|---|---|---|");
    for (const g of gaps) {
      const notes =
        g.status === "specified-only"
          ? "No code evidence found"
          : "No test coverage";
      lines.push(`| ${g.description} | ${g.status} | ${notes} |`);
    }
    for (const u of unspecified) {
      lines.push(
        `| ${u.description} | unspecified | Found in ${u.codeLocations.join(", ")} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
