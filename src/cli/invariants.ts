import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export async function run(args: string[], flags: Record<string, string | boolean>): Promise<void> {
  const wikiDir = join(process.cwd(), "wiki");
  const pagesDir = join(wikiDir, "pages");
  const invariantsDir = join(wikiDir, "invariants");
  const groupFilter = flags.group as string | undefined;

  if (!existsSync(pagesDir)) {
    console.error("No wiki found. Run `octowiki init` first.");
    process.exit(1);
  }

  const stage = flags.stage ? parseInt(flags.stage as string, 10) : null;

  if (stage === 1 || stage === null) {
    console.log("Stage 1: Extracting spec invariants...");
    const { prepareSpecBatches, writeSpecBatches } = await import("../invariants/extract-spec");
    const outDir = join(invariantsDir, "staging");
    mkdirSync(outDir, { recursive: true });
    const batches = prepareSpecBatches(pagesDir);
    writeSpecBatches(batches, outDir);
    for (const b of batches) {
      console.log(`  ${b.category}: ${b.pages.length} pages`);
    }
    if (stage === 1) return;
  }

  if (stage === 2 || stage === null) {
    console.log("Stage 2: Extracting evidence from source code...");
    const treeFile = join(invariantsDir, "tree.json");
    if (!existsSync(treeFile)) {
      console.error("No tree.json found. Run stage 1 first (with LLM processing via the skill).");
      process.exit(1);
    }

    const { prepareEvidenceInputs } = await import("../invariants/extract-evidence");
    const tree = JSON.parse(readFileSync(treeFile, "utf-8"));
    const srcDir = join(process.cwd(), "src");
    const outDir = join(invariantsDir, "staging");
    mkdirSync(outDir, { recursive: true });

    let inputs = prepareEvidenceInputs(tree, srcDir);
    if (groupFilter) {
      inputs = inputs.filter((i) => i.group === groupFilter);
    }
    for (const input of inputs) {
      writeFileSync(
        join(outDir, `evidence-${input.group}.json`),
        JSON.stringify(input, null, 2)
      );
      console.log(`  ${input.group}: ${input.invariants.length} invariants, ${input.sourceFiles.length} source files`);
    }
    if (stage === 2) return;
  }

  if (stage === 3 || stage === null) {
    console.log("Stage 3: Comparing spec vs evidence...");
    const treeFile = join(invariantsDir, "tree.json");
    const evidenceFile = join(invariantsDir, "evidence.json");

    if (!existsSync(treeFile) || !existsSync(evidenceFile)) {
      console.error("Missing tree.json or evidence.json. Run stages 1 and 2 first.");
      process.exit(1);
    }

    const { compareTreeAndEvidence } = await import("../invariants/compare");
    const { assembleInvariantPages } = await import("../invariants/assemble");

    const tree = JSON.parse(readFileSync(treeFile, "utf-8"));
    const evidence = JSON.parse(readFileSync(evidenceFile, "utf-8"));

    const report = compareTreeAndEvidence(tree, evidence);
    assembleInvariantPages(report, invariantsDir);
  }
}
