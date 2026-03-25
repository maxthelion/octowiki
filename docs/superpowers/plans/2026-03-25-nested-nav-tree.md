# Nested Navigation Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tier nesting to the sidebar nav tree via `parent` and `overview` frontmatter fields, with per-node collapse and dynamic categories from the taxonomy API.

**Architecture:** Two optional frontmatter fields (`parent`, `overview`) create a recursive tree within each category. The taxonomy parser is fixed to read from the actual taxonomy file. The frontend builds the tree client-side with a recursive `TreeNode` component.

**Tech Stack:** TypeScript, Bun, Hono, React, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-25-nested-nav-tree-design.md`

---

### Task 1: Add `parent` and `overview` to type definitions

**Files:**
- Modify: `src/types.ts:1-19` (both `WikiPage` and `PageFrontmatter`)

- [ ] **Step 1: Write the failing test**

Add a test to `src/wiki/__tests__/pages.test.ts` that reads a page with `parent` and `overview` fields:

```ts
test("reads a page with parent and overview fields", () => {
  writeFileSync(
    join(PAGES_DIR, "child-page.md"),
    `---
title: Child Page
category: architecture
parent: parent-page
overview: true
tags: []
summary: ""
last-modified-by: user
---

## Content`
  );
  const page = readPage(PAGES_DIR, "child-page");
  expect(page).not.toBeNull();
  expect(page!.parent).toBe("parent-page");
  expect(page!.overview).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/wiki/__tests__/pages.test.ts`
Expected: FAIL — `parent` and `overview` properties don't exist on `WikiPage`

- [ ] **Step 3: Add fields to types and readPage**

In `src/types.ts`, add to `WikiPage`:
```ts
parent?: string;
overview?: boolean;
```

Add to `PageFrontmatter`:
```ts
parent?: string;
overview?: boolean;
```

In `src/wiki/pages.ts`, update the return object in `readPage` to include:
```ts
parent: data.parent,
overview: data.overview ?? false,
```

- [ ] **Step 4: Add test for page without parent/overview (backward compat)**

Add to `src/wiki/__tests__/pages.test.ts`:

```ts
test("page without parent/overview defaults correctly", () => {
  writeFileSync(
    join(PAGES_DIR, "plain-page.md"),
    `---
title: Plain Page
category: meta
tags: []
summary: ""
last-modified-by: user
---

## Content`
  );
  const page = readPage(PAGES_DIR, "plain-page");
  expect(page).not.toBeNull();
  expect(page!.parent).toBeUndefined();
  expect(page!.overview).toBe(false);
});
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `bun test src/wiki/__tests__/pages.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```
git add src/types.ts src/wiki/pages.ts src/wiki/__tests__/pages.test.ts
git commit -m "feat: add parent and overview fields to WikiPage types and readPage"
```

---

### Task 2: Verify API passes new fields through

**Files:**
- Test: `src/server/__tests__/pages.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/server/__tests__/pages.test.ts`:

```ts
describe("GET /api/pages with parent/overview", () => {
  test("returns parent and overview in page summaries", async () => {
    writeFileSync(
      join(TEST_WIKI, "pages/child-page.md"),
      `---
title: Child Page
category: architecture
parent: test-page
overview: true
tags: []
summary: ""
last-modified-by: user
---

## Content`
    );
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages");
    const data = await res.json();
    const child = data.find((p: any) => p.slug === "child-page");
    expect(child).toBeDefined();
    expect(child.parent).toBe("test-page");
    expect(child.overview).toBe(true);
  });

  test("omits parent for pages without one", async () => {
    const app = createApp({ wikiDir: TEST_WIKI });
    const res = await app.request("/api/pages");
    const data = await res.json();
    const page = data.find((p: any) => p.slug === "test-page");
    expect(page.parent).toBeUndefined();
    expect(page.overview).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test src/server/__tests__/pages.test.ts`
Expected: all PASS (the API spreads `{ content, ...rest }` so new fields flow through automatically from Task 1)

- [ ] **Step 3: Commit**

```
git add src/server/__tests__/pages.test.ts
git commit -m "test: verify API passes parent and overview fields through"
```

---

### Task 3: Fix taxonomy parser and route

**Files:**
- Modify: `src/wiki/taxonomy.ts`
- Modify: `src/server/routes/taxonomy.ts`
- Test: `src/wiki/__tests__/taxonomy.test.ts` (create)

The current `loadTaxonomy()` reads from `wiki/meta/taxonomy.md` (doesn't exist) and parses `- item` list format. The actual taxonomy is in `wiki/pages/category-taxonomy.md` using `### heading` format.

- [ ] **Step 1: Write the failing test**

Create `src/wiki/__tests__/taxonomy.test.ts`:

```ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadTaxonomy } from "../taxonomy";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/octowiki-test-taxonomy";

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("loadTaxonomy", () => {
  test("parses ### heading categories", () => {
    writeFileSync(
      join(TEST_DIR, "category-taxonomy.md"),
      `---
title: Category Taxonomy
category: meta
---

## Categories

### architecture

**What belongs here:** System structure.

### pipeline

**What belongs here:** Data flow.

### data-model

**What belongs here:** Schemas.

## Usage

Some other content.`
    );
    const result = loadTaxonomy(join(TEST_DIR, "category-taxonomy.md"));
    expect(result.categories).toEqual(["architecture", "pipeline", "data-model"]);
  });

  test("returns empty for missing file", () => {
    const result = loadTaxonomy(join(TEST_DIR, "nonexistent.md"));
    expect(result.categories).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/wiki/__tests__/taxonomy.test.ts`
Expected: FAIL — `loadTaxonomy` doesn't parse `###` headings

- [ ] **Step 3: Update loadTaxonomy to parse ### headings**

Replace the parsing logic in `src/wiki/taxonomy.ts` to handle both `- item` list format and `### heading` format under `## Categories`:

```ts
export function loadTaxonomy(filePath: string): Taxonomy {
  if (!existsSync(filePath)) {
    return { categories: [], tags: {} };
  }

  const raw = readFileSync(filePath, "utf-8");
  const categories: string[] = [];
  const tags: Record<string, string> = {};
  let section: "categories" | "tags" | null = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("## Categories")) {
      section = "categories";
    } else if (line.startsWith("## ") && section !== null) {
      // Any other ## heading ends the current section
      section = line.startsWith("## Tags") ? "tags" : null;
    } else if (section === "categories") {
      // Parse ### heading format (from category-taxonomy.md)
      if (line.startsWith("### ")) {
        categories.push(line.slice(4).trim());
      }
      // Parse - item format (legacy)
      else if (line.startsWith("- ")) {
        categories.push(line.slice(2).split(" — ")[0].trim().replace(/`/g, ""));
      }
    } else if (line.startsWith("- ") && section === "tags") {
      const parts = line.slice(2).split(" — ");
      const name = parts[0].trim().replace(/`/g, "").replace(/^#/, "");
      const desc = parts[1]?.trim() ?? "";
      tags[name] = desc;
    }
  }

  return { categories, tags };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/wiki/__tests__/taxonomy.test.ts`
Expected: all PASS

- [ ] **Step 5: Update taxonomy route to read from pages directory**

In `src/server/routes/taxonomy.ts`, change the file path:

```ts
router.get("/taxonomy", (c) => {
  const taxonomy = loadTaxonomy(join(ctx.wikiDir, "pages/category-taxonomy.md"));
  return c.json(taxonomy);
});
```

- [ ] **Step 6: Run all tests**

Run: `bun test`
Expected: all PASS

- [ ] **Step 7: Commit**

```
git add src/wiki/taxonomy.ts src/server/routes/taxonomy.ts src/wiki/__tests__/taxonomy.test.ts
git commit -m "fix: taxonomy parser reads category-taxonomy.md with ### heading format"
```

---

### Task 4: Add `useTaxonomy` hook

**Files:**
- Modify: `web/src/hooks/usePages.ts`

- [ ] **Step 1: Add the hook and update PageSummary**

Add `parent?: string` and `overview?: boolean` to the `PageSummary` interface in `web/src/hooks/usePages.ts`.

Add the `useTaxonomy` hook:

```ts
interface Taxonomy {
  categories: string[];
  tags: Record<string, string>;
}

export function useTaxonomy() {
  return useQuery<Taxonomy>({
    queryKey: ["taxonomy"],
    queryFn: () => fetchJson("/api/taxonomy"),
  });
}
```

- [ ] **Step 2: Commit**

```
git add web/src/hooks/usePages.ts
git commit -m "feat: add useTaxonomy hook and parent/overview to PageSummary"
```

---

### Task 5: Extract and test `buildTree` utility

**Files:**
- Create: `web/src/lib/buildTree.ts`
- Create: `web/src/lib/__tests__/buildTree.test.ts`

Extract the tree-building logic into a standalone pure function so it can be unit tested independently of React.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/__tests__/buildTree.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test web/src/lib/__tests__/buildTree.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement buildTree**

Create `web/src/lib/buildTree.ts`:

```ts
interface PageSummary {
  slug: string;
  title: string;
  category: string;
  parent?: string;
  overview?: boolean;
  tags: string[];
  summary: string;
  lastModifiedBy: string;
}

export interface TreeNodeData {
  page: PageSummary;
  children: TreeNodeData[];
}

export function buildTree(pages: PageSummary[]): TreeNodeData[] {
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  const childrenMap = new Map<string | undefined, PageSummary[]>();

  for (const page of pages) {
    const parentSlug = page.parent && bySlug.has(page.parent) ? page.parent : undefined;

    let effectiveParent = parentSlug;
    if (parentSlug) {
      // Cycle detection: walk ancestor chain
      const visited = new Set<string>();
      let current: string | undefined = parentSlug;
      while (current) {
        if (current === page.slug || visited.has(current)) {
          effectiveParent = undefined;
          break;
        }
        visited.add(current);
        const parentPage = bySlug.get(current);
        current = parentPage?.parent && bySlug.has(parentPage.parent) ? parentPage.parent : undefined;
      }
    }

    const list = childrenMap.get(effectiveParent) ?? [];
    list.push(page);
    childrenMap.set(effectiveParent, list);
  }

  function sortPages(list: PageSummary[]): PageSummary[] {
    return [...list].sort((a, b) => {
      if (a.overview && !b.overview) return -1;
      if (!a.overview && b.overview) return 1;
      return (a.title || a.slug).localeCompare(b.title || b.slug);
    });
  }

  function buildNodes(parentSlug: string | undefined): TreeNodeData[] {
    const children = childrenMap.get(parentSlug) ?? [];
    return sortPages(children).map(page => ({
      page,
      children: buildNodes(page.slug),
    }));
  }

  return buildNodes(undefined);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test web/src/lib/__tests__/buildTree.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```
git add web/src/lib/buildTree.ts web/src/lib/__tests__/buildTree.test.ts
git commit -m "feat: add buildTree utility with cycle detection and overview sorting"
```

---

### Task 6: Build the recursive tree component

**Files:**
- Modify: `web/src/components/PageList.tsx`
- Modify: `web/src/wiki.css`

This is the main frontend change. Replace the flat grouping with recursive tree building.

- [ ] **Step 1: Update PageSummary and remove CATEGORIES**

In `PageList.tsx`, update the local `PageSummary` interface to add `parent?: string` and `overview?: boolean`. Remove the `CATEGORIES` const. Import `useTaxonomy` from the hooks. Import `buildTree` and `TreeNodeData` from `../lib/buildTree`.

- [ ] **Step 2: Replace grouping logic with tree builder**

Replace the `grouped` useMemo with tree-building logic that uses the imported `buildTree` function:

1. Get categories from `useTaxonomy()`.
2. Group pages by category (same as before, but using dynamic categories). **Note:** iterate categories in the order returned by the taxonomy API — this is taxonomy-file order, not alphabetical. Append "uncategorised" at the end.
3. For each category, call `buildTree(categoryPages)` to get the nested tree.

Handle taxonomy loading state: if `useTaxonomy()` returns `isLoading`, show the same loading indicator as pages. If both pages and taxonomy are loaded, proceed with tree building.

- [ ] **Step 3: Update collapse state to use `cat:` prefix**

Change the `toggle` function and collapsed checks to use `cat:` prefix for category keys:

```ts
const toggle = (id: string) => {
  setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};
```

Category toggle calls: `toggle(\`cat:${cat}\`)`
Category collapsed checks: `collapsed.has(\`cat:${cat}\`)`
Page toggle calls: `toggle(page.slug)`
Page collapsed checks: `collapsed.has(page.slug)`

- [ ] **Step 4: Update auto-expand to include ancestor chain**

Replace the `activeCategory` memo with an `expandedAncestors` memo that returns a `Set<string>` of all IDs that should be force-expanded:

```ts
const expandedAncestors = useMemo(() => {
  const ids = new Set<string>();
  if (!pages || !activeSlug) return ids;
  const page = pages.find(p => p.slug === activeSlug);
  if (!page) return ids;

  // Expand the category
  ids.add(`cat:${page.category || "uncategorised"}`);

  // Walk up the parent chain
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  let current = page.parent;
  const visited = new Set<string>();
  while (current && bySlug.has(current) && !visited.has(current)) {
    visited.add(current);
    ids.add(current);
    current = bySlug.get(current)!.parent;
  }

  return ids;
}, [pages, activeSlug]);
```

Update collapsed checks: a node is collapsed if `collapsed.has(id) && !expandedAncestors.has(id)`.

- [ ] **Step 5: Create recursive TreeNode rendering**

Add a `TreeNode` component inside `PageList.tsx`:

```tsx
function TreeNode({
  node,
  activeSlug,
  collapsed,
  expandedAncestors,
  toggle,
  depth,
}: {
  node: TreeNodeData;
  activeSlug?: string;
  collapsed: Set<string>;
  expandedAncestors: Set<string>;
  toggle: (id: string) => void;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.page.slug) && !expandedAncestors.has(node.page.slug);

  return (
    <li>
      <div style={{ display: "flex", alignItems: "center" }}>
        {hasChildren ? (
          <button
            className="tree-arrow"
            onClick={(e) => { e.preventDefault(); toggle(node.page.slug); }}
          >
            {isCollapsed ? "\u25B6" : "\u25BC"}
          </button>
        ) : (
          <span className="tree-arrow" />
        )}
        <Link
          to={`/page/${node.page.slug}`}
          className={`page-link${node.page.slug === activeSlug ? " active" : ""}`}
        >
          {node.page.title || node.page.slug}
        </Link>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="tree-pages">
          {node.children.map(child => (
            <TreeNode
              key={child.page.slug}
              node={child}
              activeSlug={activeSlug}
              collapsed={collapsed}
              expandedAncestors={expandedAncestors}
              toggle={toggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [ ] **Step 6: Update category rendering to use dynamic categories and TreeNode**

Replace the category rendering loop to:
1. Use categories from `useTaxonomy()` instead of `CATEGORIES`.
2. Render each category's pages using `TreeNode` for each top-level node in the category's tree.
3. Use `cat:` prefixed keys for category collapse state.
4. Show total page count per category (all descendants).

- [ ] **Step 7: Add CSS for page-level toggle buttons**

In `web/src/wiki.css`, add styles so `.tree-arrow` works as both a `<span>` (for leaf nodes) and a `<button>` (for parent page toggles). The existing `.tree-arrow` styles work for spans inside category buttons; when used as standalone buttons on page nodes they need button-reset styles:

```css
button.tree-arrow { background: none; border: none; padding: 0; cursor: pointer; }
```

- [ ] **Step 8: Manually test in browser**

Run: `bun --hot src/server/index.ts` (or however the dev server starts)
Verify:
- Categories load dynamically (including `algorithms`)
- Existing pages appear correctly under their categories
- Collapsing/expanding categories works
- No regressions in navigation

- [ ] **Step 9: Commit**

```
git add web/src/components/PageList.tsx web/src/wiki.css
git commit -m "feat: recursive tree nav with dynamic categories, parent nesting, overview sorting"
```

---

### Task 7: Test nesting with real wiki pages

**Files:**
- Modify: wiki page frontmatter (pick 2-3 pages to add `parent` to)

- [ ] **Step 1: Add parent to a couple of wiki pages for testing**

Pick 2-3 existing wiki pages that have a natural parent-child relationship and add `parent: <slug>` to their frontmatter. For example, if there are pages within `architecture` that naturally nest under another.

- [ ] **Step 2: Add overview flag to one page per category**

Pick a suitable page in 1-2 categories and add `overview: true` to verify it sorts first.

- [ ] **Step 3: Verify in browser**

Run the dev server and confirm:
- Nested pages appear indented under their parent
- Parent pages show expand/collapse arrows
- Overview pages appear first at their level
- Auto-expand works: navigating directly to a nested page's URL expands its ancestor chain
- Collapsing a parent hides its children
- Category count shows total (including nested) pages

- [ ] **Step 4: Commit**

```
git add wiki/pages/
git commit -m "feat: add parent/overview to sample wiki pages for nested nav"
```

---

### Task 8: Update wiki documentation

**Files:**
- Modify: `wiki/pages/sidebar-tree-navigation.md`
- Modify: `wiki/pages/category-taxonomy.md`

- [ ] **Step 1: Update sidebar-tree-navigation.md**

Update the wiki page to describe:
- The `parent` frontmatter field and same-category constraint
- The `overview` flag and its sort behavior
- Per-node collapse/expand (not just per-category)
- Auto-expand of ancestor chain for active page
- Dynamic categories from taxonomy API
- Graceful fallback for invalid/missing parents
- Updated visual mockup showing nested structure

- [ ] **Step 2: Update category-taxonomy.md**

Add a note in the Usage section that categories are now fetched dynamically by the frontend sidebar via `GET /api/taxonomy`, so adding/removing a category here automatically updates the navigation.

- [ ] **Step 3: Commit**

```
git add wiki/pages/sidebar-tree-navigation.md wiki/pages/category-taxonomy.md
git commit -m "docs: update wiki pages for nested nav tree and dynamic categories"
```

---

### Task 9: Run full test suite and verify

- [ ] **Step 1: Run all tests**

Run: `bun test`
Expected: all PASS

- [ ] **Step 2: Fix any failures**

If any tests fail, fix them.

- [ ] **Step 3: Final commit if needed**

```
git commit -m "fix: address test failures from nested nav tree changes"
```
