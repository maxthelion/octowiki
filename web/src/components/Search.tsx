import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SearchResult } from "../types";

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearchParams({ q });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(res.statusText);
      setResults(await res.json());
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="page-section">
      <h1>Search</h1>
      <form onSubmit={(e) => { e.preventDefault(); doSearch(input); }} className="search-form">
        <input
          className="search-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search wiki..."
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      {loading && <p>Searching...</p>}
      {results.length === 0 && query && !loading && <p className="empty">No results.</p>}
      {results.map((r, i) => (
        <div key={i} className="search-result">
          <Link to={`/page/${r.slug ?? r.id ?? i}`}>{r.title ?? r.slug ?? `Result ${i + 1}`}</Link>
          {r.summary && <p>{r.summary}</p>}
        </div>
      ))}
    </div>
  );
}
