import { describe, test, expect } from "bun:test";
import { parseWikilinks } from "../wikilinks";

describe("parseWikilinks", () => {
  test("parses simple page link", () => {
    const links = parseWikilinks("See [[road-network]] for details.");
    expect(links).toHaveLength(1);
    expect(links[0].type).toBe("link");
    expect(links[0].target).toBe("road-network");
  });

  test("parses embed (summary)", () => {
    const links = parseWikilinks("Overview: [[!road-network]]");
    expect(links[0].type).toBe("embed");
    expect(links[0].target).toBe("road-network");
  });

  test("parses full embed", () => {
    const links = parseWikilinks("Full: [[!!road-network]]");
    expect(links[0].type).toBe("full-embed");
    expect(links[0].target).toBe("road-network");
  });

  test("parses source reference by function", () => {
    const links = parseWikilinks("See [[src:road.ts#buildFrontier]]");
    expect(links[0].type).toBe("src");
    expect(links[0].target).toBe("road.ts");
    expect(links[0].anchor).toBe("buildFrontier");
  });

  test("parses source reference by line range", () => {
    const links = parseWikilinks("See [[src:road.ts#142-167]]");
    expect(links[0].type).toBe("src");
    expect(links[0].target).toBe("road.ts");
    expect(links[0].anchor).toBe("142-167");
  });

  test("parses git ref", () => {
    const links = parseWikilinks("Changed in [[ref:git:abc123f]]");
    expect(links[0].type).toBe("ref");
    expect(links[0].refType).toBe("git");
    expect(links[0].target).toBe("abc123f");
  });

  test("parses PR ref", () => {
    const links = parseWikilinks("See [[ref:pr:47]]");
    expect(links[0].type).toBe("ref");
    expect(links[0].refType).toBe("pr");
    expect(links[0].target).toBe("47");
  });

  test("parses doc ref", () => {
    const links = parseWikilinks("See [[ref:doc:README.md#section]]");
    expect(links[0].type).toBe("ref");
    expect(links[0].refType).toBe("doc");
    expect(links[0].target).toBe("README.md");
    expect(links[0].anchor).toBe("section");
  });

  test("parses test ref", () => {
    const links = parseWikilinks("See [[ref:test:road.test.ts#L42]]");
    expect(links[0].type).toBe("ref");
    expect(links[0].refType).toBe("test");
    expect(links[0].target).toBe("road.test.ts");
    expect(links[0].anchor).toBe("L42");
  });

  test("parses multiple links in one string", () => {
    const links = parseWikilinks(
      "See [[road-network]] and [[!blocks]] and [[src:file.ts#fn]]"
    );
    expect(links).toHaveLength(3);
  });

  test("returns empty array for no links", () => {
    const links = parseWikilinks("No links here.");
    expect(links).toEqual([]);
  });
});
