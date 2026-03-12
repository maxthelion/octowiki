import { useState } from "react";

export function SourceBlock({ file, anchor }: { file: string; anchor?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 6,
        marginBlock: 8,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#f6f8fa",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontFamily: "monospace",
        }}
      >
        <span>{file}{anchor ? `#${anchor}` : ""}</span>
        <span>{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && (
        <pre style={{ padding: 12, margin: 0, fontSize: 13, overflow: "auto", background: "#fafafa" }}>
          <code>Source reference: {file}{anchor ? `#${anchor}` : ""}</code>
        </pre>
      )}
    </div>
  );
}
