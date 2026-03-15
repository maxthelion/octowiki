export interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(["port", "stage", "group"]);

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { command: "help", args: [], flags: {} };
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    return { command: "version", args: [], flags: {} };
  }

  const command = argv[0];
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (VALUE_FLAGS.has(name) && i + 1 < argv.length) {
        flags[name] = argv[++i];
      } else {
        flags[name] = true;
      }
    } else {
      args.push(arg);
    }
    i++;
  }

  return { command, args, flags };
}
