import { join } from "path";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";

export async function run(args: string[], flags: Record<string, string | boolean>): Promise<void> {
  let subcommand = args[0];

  // `octowiki import <path>` is shorthand for `octowiki import discover <path>`
  if (subcommand && !["discover", "group", "apply"].includes(subcommand)) {
    args.unshift("discover");
    subcommand = "discover";
  }

  if (!subcommand) {
    console.log("Usage:");
    console.log("  octowiki import <path>               Shorthand for discover");
    console.log("  octowiki import discover <path>       Discover markdown files");
    console.log("  octowiki import group <staging-dir>   Group extracted topics");
    console.log("  octowiki import apply <staging-dir>   Apply staged pages to wiki");
    return;
  }

  switch (subcommand) {
    case "discover": {
      const repoPath = args[1] || process.cwd();
      const { createManifest } = await import("../batch-import/discover");
      const manifest = createManifest(repoPath);
      console.log(`Found ${manifest.files.length} files.`);
      for (const f of manifest.files) {
        console.log(`  ${f.relativePath} (${f.sizeBytes} bytes)`);
      }
      console.log(`\nManifest: ${manifest.tmpDir}/manifest.json`);

      if (manifest.files.length > 200 && !flags.force) {
        console.error(`\n${manifest.files.length} files found. Use --force to proceed.`);
        process.exit(1);
      }
      break;
    }

    case "group": {
      const stagingDir = args[1];
      if (!stagingDir) {
        console.error("Usage: octowiki import group <staging-dir>");
        process.exit(1);
      }

      const mapDir = join(stagingDir, "map");
      if (!existsSync(mapDir)) {
        console.error(`Map directory not found: ${mapDir}`);
        process.exit(1);
      }

      const { groupMapOutputs } = await import("../batch-import/group");

      const mapFiles = readdirSync(mapDir).filter((f) => f.endsWith(".json"));
      const mapOutputs = mapFiles.map((f) =>
        JSON.parse(readFileSync(join(mapDir, f), "utf-8"))
      );

      const pagesDir = join(process.cwd(), "wiki/pages");
      const existingPages: Record<string, string> = {};
      if (existsSync(pagesDir)) {
        for (const f of readdirSync(pagesDir).filter((f) => f.endsWith(".md"))) {
          const slug = f.replace(".md", "");
          existingPages[slug] = readFileSync(join(pagesDir, f), "utf-8");
        }
      }

      const groups = groupMapOutputs(mapOutputs, existingPages);
      writeFileSync(join(stagingDir, "groups.json"), JSON.stringify(groups, null, 2));

      console.log(`Grouped into ${groups.newPages.length} new pages, ${groups.mergeIntoExisting.length} merges, ${groups.skipped.length} skipped.`);
      break;
    }

    case "apply": {
      const stagingDir = args[1];
      if (!stagingDir) {
        console.error("Usage: octowiki import apply <staging-dir>");
        process.exit(1);
      }

      const reduceDir = join(stagingDir, "reduce");
      if (!existsSync(reduceDir)) {
        console.error(`Reduce directory not found: ${reduceDir}`);
        process.exit(1);
      }

      const wikiDir = join(process.cwd(), "wiki/pages");
      const backupDir = join(process.cwd(), "wiki/pages-pre-import");

      if (flags.revert) {
        const { revert } = await import("../batch-import/apply");
        revert(wikiDir, backupDir);
      } else {
        const { apply } = await import("../batch-import/apply");
        apply(reduceDir, wikiDir, backupDir);
      }
      break;
    }
  }
}
