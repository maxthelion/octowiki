import { Link, useParams } from "react-router-dom";
import { usePageList, useCreatePage } from "../hooks/usePages";
import { useState, useMemo } from "react";

const CATEGORIES = [
  "architecture",
  "data-model",
  "decisions",
  "functionality",
  "meta",
  "observability",
  "pipeline",
  "rendering",
  "testing",
  "ui",
];

interface PageSummary {
  slug: string;
  title: string;
  category: string;
}

export function PageList() {
  const { data: pages, isLoading } = usePageList();
  const { slug: activeSlug } = useParams();
  const createPage = useCreatePage();
  const [showAdd, setShowAdd] = useState(false);
  const [notes, setNotes] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    if (!pages) return null;

    const groups: Record<string, PageSummary[]> = {};
    for (const cat of CATEGORIES) {
      groups[cat] = [];
    }
    groups["uncategorised"] = [];

    for (const page of pages) {
      const cat = page.category && CATEGORIES.includes(page.category)
        ? page.category
        : "uncategorised";
      groups[cat].push(page);
    }

    // Sort pages within each category
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => (a.title || a.slug).localeCompare(b.title || b.slug));
    }

    return groups;
  }, [pages]);

  const toggle = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Auto-expand the category containing the active page
  const activeCategory = useMemo(() => {
    if (!pages || !activeSlug) return null;
    const page = pages.find((p) => p.slug === activeSlug);
    if (!page) return null;
    return page.category && CATEGORIES.includes(page.category)
      ? page.category
      : "uncategorised";
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
          {[...CATEGORIES, "uncategorised"].map((cat) => {
            const catPages = grouped[cat];
            if (cat === "uncategorised" && catPages.length === 0) return null;
            const isEmpty = catPages.length === 0;
            const isCollapsed = collapsed.has(cat) && cat !== activeCategory;

            return (
              <div key={cat} className="tree-group">
                <button
                  className={`tree-category${isEmpty ? " tree-category-empty" : ""}`}
                  onClick={() => !isEmpty && toggle(cat)}
                >
                  <span className="tree-arrow">{isEmpty ? "" : isCollapsed ? "\u25B6" : "\u25BC"}</span>
                  {cat}
                  {!isEmpty && <span className="tree-count">{catPages.length}</span>}
                </button>
                {!isCollapsed && catPages.length > 0 && (
                  <ul className="tree-pages">
                    {catPages.map((page) => (
                      <li key={page.slug}>
                        <Link
                          to={`/page/${page.slug}`}
                          className={`page-link${page.slug === activeSlug ? " active" : ""}`}
                        >
                          {page.title || page.slug}
                        </Link>
                      </li>
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
