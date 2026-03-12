import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/api/sse");

    eventSource.addEventListener("page-changed", (e) => {
      const data = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: ["page", data.slug] });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    });

    eventSource.addEventListener("feed-updated", () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    });

    eventSource.addEventListener("plan-status-changed", () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    });

    return () => eventSource.close();
  }, [queryClient]);
}
