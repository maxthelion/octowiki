import { useParams } from "react-router-dom";
import { usePage } from "../hooks/usePages";
import { renderMarkdown } from "../lib/markdown";
import { ChatBox } from "./ChatBox";

export function PageView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug!);

  if (isLoading) return <div style={{ padding: 32 }}>Loading...</div>;
  if (error || !page) return <div style={{ padding: 32 }}>Page not found.</div>;

  return (
    <div>
      <article style={{ padding: "24px 32px", maxWidth: 800 }}>
        <h1 style={{ marginBottom: 8 }}>{page.title}</h1>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
          <span>{page.category}</span>
          {page.tags.map((tag) => (
            <span key={tag} style={{ marginLeft: 8, background: "#e8e8e8", padding: "2px 6px", borderRadius: 3 }}>
              {tag}
            </span>
          ))}
        </div>
        <div
          className="wiki-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
        />
      </article>
      <ChatBox slug={slug!} />
    </div>
  );
}
