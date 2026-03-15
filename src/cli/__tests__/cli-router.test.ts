import { describe, test, expect } from "bun:test";
import { parseArgs } from "../../cli/parse-args";

describe("parseArgs", () => {
  test("parses subcommand with no flags", () => {
    const result = parseArgs(["setup"]);
    expect(result.command).toBe("setup");
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({});
  });

  test("parses subcommand with positional args", () => {
    const result = parseArgs(["import", "discover", "/tmp/repo"]);
    expect(result.command).toBe("import");
    expect(result.args).toEqual(["discover", "/tmp/repo"]);
  });

  test("parses flags", () => {
    const result = parseArgs(["setup", "--global"]);
    expect(result.command).toBe("setup");
    expect(result.flags.global).toBe(true);
  });

  test("parses --port with value", () => {
    const result = parseArgs(["serve", "--port", "3000"]);
    expect(result.command).toBe("serve");
    expect(result.flags.port).toBe("3000");
  });

  test("returns help for no args", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("help");
  });

  test("returns help for --help", () => {
    const result = parseArgs(["--help"]);
    expect(result.command).toBe("help");
  });

  test("returns version for --version", () => {
    const result = parseArgs(["--version"]);
    expect(result.command).toBe("version");
  });
});
