import { useState } from "react";
import { useFeed, useCreatePlan } from "../hooks/usePages";
import { Link } from "react-router-dom";

export function ChangesFeed() {
  const { data: feed, isLoading } = useFeed();
  const createPlan = useCreatePlan();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) return <div style={{ padding: 32 }}>Loading feed...</div>;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Changes Feed</h1>
        {selected.size > 0 && (
          <button
            onClick={() => {
              createPlan.mutate([...selected]);
              setSelected(new Set());
            }}
            disabled={createPlan.isPending}
            style={{
              padding: "8px 16px",
              background: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {createPlan.isPending ? "Planning..." : `Plan this (${selected.size})`}
          </button>
        )}
      </div>

      {!feed?.length && <p style={{ color: "#666" }}>No changes yet.</p>}

      {feed?.map((change: any) => (
        <div
          key={change.id}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={selected.has(change.id)}
              onChange={() => toggle(change.id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>
                <Link to={`/page/${change.page}`}>{change.page}</Link>
              </div>
              <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>{change.summary}</p>
              <div style={{ fontSize: 12, color: "#888" }}>
                {change.tags?.map((t: string) => (
                  <span key={t} style={{ marginRight: 6, background: "#f0f0f0", padding: "1px 4px", borderRadius: 3 }}>
                    {t}
                  </span>
                ))}
                <span style={{ marginLeft: 8 }}>{new Date(change.timestamp).toLocaleString()}</span>
              </div>
              {change.affectedPages?.length > 0 && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Affects: {change.affectedPages.map((p: string) => (
                    <Link key={p} to={`/page/${p}`} style={{ marginRight: 6 }}>{p}</Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
