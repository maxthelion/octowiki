import { useState } from "react";
import { useSendChat } from "../hooks/usePages";

export function ChatBox({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  const sendChat = useSendChat(slug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendChat.isPending) return;
    sendChat.mutate(message);
    setMessage("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        position: "fixed",
        bottom: 0,
        left: 250,
        right: 0,
        padding: "12px 32px",
        background: "#fff",
        borderTop: "1px solid #e0e0e0",
        display: "flex",
        gap: 8,
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about this page..."
        disabled={sendChat.isPending}
        style={{
          flex: 1,
          padding: "10px 14px",
          border: "1px solid #ccc",
          borderRadius: 6,
          fontSize: 14,
        }}
      />
      <button
        type="submit"
        disabled={sendChat.isPending || !message.trim()}
        style={{
          padding: "10px 20px",
          background: "#0066cc",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        {sendChat.isPending ? "..." : "Send"}
      </button>
    </form>
  );
}
