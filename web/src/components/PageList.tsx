import { Link, useParams } from "react-router-dom";
import { usePageList, useCreatePage } from "../hooks/usePages";
import { useState } from "react";

export function PageList() {
  const { data: pages, isLoading } = usePageList();
  const { slug: activeSlug } = useParams();
  const createPage = useCreatePage();
  const [showAdd, setShowAdd] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <nav style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Pages</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{ cursor: "pointer" }}>+</button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Page title and notes..."
            style={{ width: "100%", minHeight: 60, padding: 8, fontSize: 13 }}
          />
          <button
            onClick={() => {
              if (notes.trim()) {
                createPage.mutate({ notes });
                setNotes("");
                setShowAdd(false);
              }
            }}
            style={{ marginTop: 4, cursor: "pointer" }}
          >
            Add Page
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Link to="/feed" style={{ fontSize: 13 }}>Feed</Link>
        <Link to="/inbox" style={{ fontSize: 13 }}>Inbox</Link>
        <Link to="/search" style={{ fontSize: 13 }}>Search</Link>
      </div>

      {isLoading && <p>Loading...</p>}

      <ul style={{ listStyle: "none" }}>
        {pages?.map((page) => (
          <li key={page.slug} style={{ marginBottom: 4 }}>
            <Link
              to={`/page/${page.slug}`}
              style={{
                display: "block",
                padding: "6px 8px",
                borderRadius: 4,
                textDecoration: "none",
                color: page.slug === activeSlug ? "#fff" : "#333",
                background: page.slug === activeSlug ? "#0066cc" : "transparent",
                fontSize: 14,
              }}
            >
              {page.title || page.slug}
              {page.category && (
                <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>{page.category}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
