import { useState, useEffect } from "react";

export function SourceBlock({ file, anchor }: { file: string; anchor?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!expanded || content !== null) return;
    fetch(`/api/source?file=${encodeURIComponent(file)}${anchor ? `&anchor=${encodeURIComponent(anchor)}` : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [expanded, file, anchor, content]);

  return (
    <div className="source-block">
      <button className="source-header" onClick={() => setExpanded(!expanded)}>
        <span>{file}{anchor ? `#${anchor}` : ""}</span>
        <span>{expanded ? "\u25BC" : "\u25B6"}</span>
      </button>
      {expanded && (
        <pre className="source-body">
          <code>
            {content ?? (error ? `Could not load ${file}` : "Loading...")}
          </code>
        </pre>
      )}
    </div>
  );
}
