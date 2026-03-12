import { useParams } from "react-router-dom";
import { usePage } from "../hooks/usePages";
import { renderMarkdown } from "../lib/markdown";
import { ChatBox } from "./ChatBox";

export function PageView() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug!);

  if (isLoading) return <div className="loading">Loading...</div>;
  if (error || !page) return <div className="loading">Page not found.</div>;

  return (
    <div>
      <article className="page-article">
        <h1 className="page-title">{page.title}</h1>
        <div className="page-meta">
          <span>{page.category}</span>
          {page.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
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
