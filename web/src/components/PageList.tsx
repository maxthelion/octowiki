import { Link, useParams } from "react-router-dom";
import { usePageList, useCreatePage, useTaxonomy } from "../hooks/usePages";
import { useState, useMemo } from "react";
import { buildTree, TreeNodeData } from "../lib/buildTree";

interface PageSummary {
  slug: string;
  title: string;
  category: string;
  parent?: string;
  overview?: boolean;
}

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

export function PageList() {
  const { data: pages, isLoading: pagesLoading } = usePageList();
  const { data: taxonomy, isLoading: taxonomyLoading } = useTaxonomy();
  const { slug: activeSlug } = useParams();
  const createPage = useCreatePage();
  const [showAdd, setShowAdd] = useState(false);
  const [notes, setNotes] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const isLoading = pagesLoading || taxonomyLoading;

  const categories = useMemo(() => {
    if (!taxonomy) return null;
    return taxonomy.categories;
  }, [taxonomy]);

  const grouped = useMemo(() => {
    if (!pages || !categories) return null;

    const groups: Record<string, TreeNodeData[]> = {};
    const pageCounts: Record<string, number> = {};

    // Build page lists per category in taxonomy order
    const categoryPages: Record<string, PageSummary[]> = {};
    for (const cat of categories) {
      categoryPages[cat] = [];
    }
    categoryPages["uncategorised"] = [];

    for (const page of pages) {
      const cat = page.category && categories.includes(page.category)
        ? page.category
        : "uncategorised";
      categoryPages[cat].push(page);
    }

    // Build tree for each category
    const orderedCategories = [...categories, "uncategorised"];
    for (const cat of orderedCategories) {
      const catPages = categoryPages[cat] ?? [];
      groups[cat] = buildTree(catPages);
      pageCounts[cat] = catPages.length;
    }

    return { groups, pageCounts, orderedCategories };
  }, [pages, categories]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Auto-expand the category and ancestor chain for the active page
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

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">OctoWiki</h2>
        <button className="sidebar-add-btn" onClick={() => setShowAdd(!showAdd)}>+</button>
      </div>

      {showAdd && (
        <div className="sidebar-add-form">
          <textarea
            className="sidebar-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Page title and notes..."
          />
          <button
            className="sidebar-submit"
            onClick={() => {
              if (notes.trim()) {
                createPage.mutate({ notes });
                setNotes("");
                setShowAdd(false);
              }
            }}
          >
            Add Page
          </button>
        </div>
      )}

      <div className="sidebar-nav">
        <Link to="/feed">Feed</Link>
        <Link to="/inbox">Inbox</Link>
        <Link to="/search">Search</Link>
      </div>

      {isLoading && <p>Loading...</p>}

      {grouped && (
        <div className="tree">
          {grouped.orderedCategories.map((cat) => {
            const treeNodes = grouped.groups[cat];
            const totalCount = grouped.pageCounts[cat];
            if (cat === "uncategorised" && totalCount === 0) return null;
            const isEmpty = totalCount === 0;
            const catKey = `cat:${cat}`;
            const isCollapsed = collapsed.has(catKey) && !expandedAncestors.has(catKey);

            return (
              <div key={cat} className="tree-group">
                <button
                  className={`tree-category${isEmpty ? " tree-category-empty" : ""}`}
                  onClick={() => !isEmpty && toggle(catKey)}
                >
                  <span className="tree-arrow">{isEmpty ? "" : isCollapsed ? "\u25B6" : "\u25BC"}</span>
                  {cat}
                  {!isEmpty && <span className="tree-count">{totalCount}</span>}
                </button>
                {!isCollapsed && treeNodes.length > 0 && (
                  <ul className="tree-pages">
                    {treeNodes.map((node) => (
                      <TreeNode
                        key={node.page.slug}
                        node={node}
                        activeSlug={activeSlug}
                        collapsed={collapsed}
                        expandedAncestors={expandedAncestors}
                        toggle={toggle}
                        depth={0}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
