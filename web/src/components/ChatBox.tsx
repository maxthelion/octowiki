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
    <form onSubmit={handleSubmit} className="chatbox">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about this page..."
        disabled={sendChat.isPending}
      />
      <button
        type="submit"
        disabled={sendChat.isPending || !message.trim()}
        className="btn btn-primary"
      >
        {sendChat.isPending ? "..." : "Send"}
      </button>
    </form>
  );
}
