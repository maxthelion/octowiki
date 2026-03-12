import { useState } from "react";
import { useFeed, useCreatePlan } from "../hooks/usePages";
import { Link } from "react-router-dom";
import type { ChangeSummary } from "../types";

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

  if (isLoading) return <div className="loading">Loading feed...</div>;

  return (
    <div className="page-section">
      <div className="card-header" style={{ marginBottom: 24 }}>
        <h1>Changes Feed</h1>
        {selected.size > 0 && (
          <button
            onClick={() => {
              createPlan.mutate([...selected]);
              setSelected(new Set());
            }}
            disabled={createPlan.isPending}
            className="btn btn-primary"
          >
            {createPlan.isPending ? "Planning..." : `Plan this (${selected.size})`}
          </button>
        )}
      </div>

      {!feed?.length && <p className="empty">No changes yet.</p>}

      {(feed as ChangeSummary[] | undefined)?.map((change) => (
        <div key={change.id} className="card">
          <div className="card-row">
            <input
              type="checkbox"
              checked={selected.has(change.id)}
              onChange={() => toggle(change.id)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div className="card-title">
                <Link to={`/page/${change.page}`}>{change.page}</Link>
              </div>
              <p className="card-text">{change.summary}</p>
              <div className="card-meta">
                {change.tags?.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
                <span style={{ marginLeft: 8 }}>{new Date(change.timestamp).toLocaleString()}</span>
              </div>
              {change.affectedPages?.length > 0 && (
                <div className="affected-pages">
                  Affects: {change.affectedPages.map((p) => (
                    <Link key={p} to={`/page/${p}`}>{p}</Link>
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
