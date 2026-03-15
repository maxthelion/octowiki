#!/usr/bin/env bun

import { join } from "path";
import { parseArgs } from "./src/cli/parse-args";

const COMMANDS: Record<string, () => Promise<(args: string[], flags: Record<string, string | boolean>) => Promise<void>>> = {
  setup: () => import("./src/cli/setup").then(m => m.run),
  init: () => import("./src/cli/init").then(m => m.run),
  serve: () => import("./src/cli/serve").then(m => m.run),
  import: () => import("./src/cli/import").then(m => m.run),
  invariants: () => import("./src/cli/invariants").then(m => m.run),
};

const USAGE = `
octowiki — AI-powered wiki for your codebase

Usage:
  octowiki setup [--global|--local]   Install Claude Code skills
  octowiki init                        Scaffold wiki directory structure
  octowiki serve [--port N]           Start wiki server
  octowiki import discover <path>     Discover markdown files
  octowiki import group <staging-dir> Group extracted topics
  octowiki import apply <staging-dir> Apply staged pages to wiki
  octowiki invariants [--stage N]     Run invariants pipeline
`.trim();

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));

  if (command === "help") {
    console.log(USAGE);
    return;
  }

  if (command === "version") {
    const pkg = await Bun.file(join(import.meta.dir, "package.json")).json();
    console.log(`octowiki v${pkg.version ?? "0.0.0"}`);
    return;
  }

  const loader = COMMANDS[command];
  if (!loader) {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    process.exit(1);
  }

  if (flags.help) {
    console.log(USAGE);
    return;
  }

  const handler = await loader();
  await handler(args, flags);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
