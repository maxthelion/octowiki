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
    <div className="app-layout">
      <aside className="app-sidebar">
        <PageList />
      </aside>
      <main className="app-main">
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
