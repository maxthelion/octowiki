import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearchParams({ q });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 800 }}>
      <h1 style={{ marginBottom: 16 }}>Search</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); doSearch(input); }}
        style={{ display: "flex", gap: 8, marginBottom: 24 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search wiki..."
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
        />
        <button type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>Search</button>
      </form>
      {loading && <p>Searching...</p>}
      {results.length === 0 && query && !loading && <p style={{ color: "#666" }}>No results.</p>}
      {results.map((r: any, i: number) => (
        <div key={i} style={{ borderBottom: "1px solid #eee", paddingBlock: 12 }}>
          <Link to={`/page/${r.slug ?? r.id ?? i}`} style={{ fontWeight: 500 }}>{r.title ?? r.slug ?? `Result ${i + 1}`}</Link>
          {r.summary && <p style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{r.summary}</p>}
        </div>
      ))}
    </div>
  );
}
