import { Routes, Route, Navigate } from "react-router-dom";
import { useSSE } from "./hooks/useSSE";
import { PageList } from "./components/PageList";
import { PageView } from "./components/PageView";
import { ChangesFeed } from "./components/ChangesFeed";
import { Inbox } from "./components/Inbox";
import { Search } from "./components/Search";

export function App() {
  useSSE();

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 250, borderRight: "1px solid #e0e0e0", overflow: "auto" }}>
        <PageList />
      </aside>
      <main style={{ flex: 1, overflow: "auto", paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/page/:slug" element={<PageView />} />
          <Route path="/feed" element={<ChangesFeed />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </main>
    </div>
  );
}
