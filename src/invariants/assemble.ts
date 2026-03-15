import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import type { ComparisonReport } from "./types";
import { renderInvariantPage } from "./render";

export function assembleInvariantPages(
  report: ComparisonReport,
  invariantsDir: string = join(process.cwd(), "wiki/invariants"),
): void {
  mkdirSync(invariantsDir, { recursive: true });

  // Write report.json
  writeFileSync(
    join(invariantsDir, "report.json"),
    JSON.stringify(report, null, 2)
  );

  // Render each group as a wiki page
  for (const group of report.groups) {
    const groupUnspecified = report.unspecified.filter((u) =>
      u.codeLocations.some((l) =>
        group.invariants.some((inv) =>
          inv.codeLocations.some((cl) => l.startsWith(cl.split("/").slice(0, -1).join("/")))
        )
      )
    );

    const page = renderInvariantPage(group.name, group.invariants, groupUnspecified);
    writeFileSync(join(invariantsDir, `${group.name}.md`), page);
  }

  // Summary
  const s = report.summary;
  console.log(`\nInvariants report:`);
  console.log(`  Total spec invariants: ${s.total}`);
  console.log(`  Implemented + tested:  ${s.implementedTested}`);
  console.log(`  Implemented, untested: ${s.implementedUntested}`);
  console.log(`  Specified only:        ${s.specifiedOnly}`);
  console.log(`  Unspecified (in code):  ${s.unspecified}`);
  console.log(`\nWrote ${report.groups.length} invariant pages to wiki/invariants/`);
}

if (import.meta.main) {
  const reportFile = process.argv[2];
  if (!reportFile) {
    console.error("Usage: bun run src/invariants/assemble.ts <report.json>");
    process.exit(1);
  }
  const report: ComparisonReport = JSON.parse(readFileSync(reportFile, "utf-8"));
  assembleInvariantPages(report);
}
