import { useState, useRef, type ReactNode } from "react";
import { usePage } from "../hooks/usePages";

export function HoverSummary({ slug, children }: { slug: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const { data: page } = usePage(show ? slug : "");
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative", display: "inline" }}
    >
      {children}
      {show && page?.summary && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            background: "#1a1a2e",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            maxWidth: 300,
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <strong>{page.title}</strong>
          <p style={{ margin: "4px 0 0", opacity: 0.9 }}>{page.summary}</p>
        </div>
      )}
    </span>
  );
}
