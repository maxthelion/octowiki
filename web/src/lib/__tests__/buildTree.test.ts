import { describe, test, expect } from "bun:test";
import { buildTree } from "../buildTree";

const page = (slug: string, overrides: Record<string, any> = {}) => ({
  slug,
  title: overrides.title ?? slug,
  category: overrides.category ?? "arch",
  parent: overrides.parent,
  overview: overrides.overview ?? false,
  tags: [],
  summary: "",
  lastModifiedBy: "user" as const,
});

describe("buildTree", () => {
  test("pages without parent are top-level", () => {
    const tree = buildTree([page("a"), page("b")]);
    expect(tree.map(n => n.page.slug)).toEqual(["a", "b"]);
    expect(tree[0].children).toEqual([]);
  });

  test("pages nest under their parent", () => {
    const tree = buildTree([page("parent"), page("child", { parent: "parent" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].page.slug).toBe("parent");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].page.slug).toBe("child");
  });

  test("multi-level nesting", () => {
    const tree = buildTree([
      page("root"),
      page("mid", { parent: "root" }),
      page("leaf", { parent: "mid" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].page.slug).toBe("leaf");
  });

  test("invalid parent falls back to top-level", () => {
    const tree = buildTree([page("orphan", { parent: "nonexistent" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].page.slug).toBe("orphan");
  });

  test("self-referential parent falls back to top-level", () => {
    const tree = buildTree([page("self", { parent: "self" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].page.slug).toBe("self");
  });

  test("circular parents break cycle", () => {
    const tree = buildTree([
      page("a", { parent: "b" }),
      page("b", { parent: "a" }),
    ]);
    // Both can't be children — at least one should be top-level
    expect(tree.length).toBeGreaterThanOrEqual(1);
    const allSlugs = tree.flatMap(function collect(n: any): string[] {
      return [n.page.slug, ...n.children.flatMap(collect)];
    });
    expect(allSlugs.sort()).toEqual(["a", "b"]);
  });

  test("overview pages sort first", () => {
    const tree = buildTree([
      page("z-page", { title: "Z Page" }),
      page("a-overview", { title: "A Overview", overview: true }),
      page("m-page", { title: "M Page" }),
    ]);
    expect(tree[0].page.slug).toBe("a-overview");
    expect(tree[1].page.slug).toBe("m-page");
    expect(tree[2].page.slug).toBe("z-page");
  });

  test("overview sorting applies within nested children too", () => {
    const tree = buildTree([
      page("parent"),
      page("z-child", { parent: "parent", title: "Z Child" }),
      page("a-child", { parent: "parent", title: "A Child", overview: true }),
    ]);
    expect(tree[0].children[0].page.slug).toBe("a-child");
    expect(tree[0].children[1].page.slug).toBe("z-child");
  });
});
