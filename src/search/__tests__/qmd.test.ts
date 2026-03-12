import { describe, test, expect } from "bun:test";
import { buildSearchCommand, buildUpdateCommand, buildEmbedCommand } from "../qmd";

describe("qmd command builders", () => {
  test("buildSearchCommand produces correct args", () => {
    const cmd = buildSearchCommand("/wiki", "road network", "search");
    expect(cmd).toEqual(["qmd", "search", "road network", "--json", "--collection", "/wiki"]);
  });

  test("buildSearchCommand supports vsearch mode", () => {
    const cmd = buildSearchCommand("/wiki", "road network", "vsearch");
    expect(cmd[1]).toBe("vsearch");
  });

  test("buildUpdateCommand produces correct args", () => {
    const cmd = buildUpdateCommand("/wiki");
    expect(cmd).toEqual(["qmd", "update", "--collection", "/wiki"]);
  });

  test("buildEmbedCommand produces correct args", () => {
    const cmd = buildEmbedCommand("/wiki");
    expect(cmd).toEqual(["qmd", "embed", "--collection", "/wiki"]);
  });
});
