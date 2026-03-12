import { useState, type ReactNode } from "react";
import { usePage } from "../hooks/usePages";

export function HoverSummary({ slug, children }: { slug: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const { data: page } = usePage(show ? slug : "");

  return (
    <span
      className="hover-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && page?.summary && (
        <div className="hover-tooltip">
          <strong>{page.title}</strong>
          <p>{page.summary}</p>
        </div>
      )}
    </span>
  );
}
