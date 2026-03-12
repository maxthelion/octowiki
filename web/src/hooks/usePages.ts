import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PageSummary {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  lastModifiedBy: string;
}

interface WikiPage extends PageSummary {
  content: string;
}

export function usePageList() {
  return useQuery<PageSummary[]>({
    queryKey: ["pages"],
    queryFn: () => fetch("/api/pages").then((r) => r.json()),
  });
}

export function usePage(slug: string) {
  return useQuery<WikiPage>({
    queryKey: ["page", slug],
    queryFn: () => fetch(`/api/pages/${slug}`).then((r) => r.json()),
    enabled: !!slug,
  });
}

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () => fetch("/api/feed").then((r) => r.json()),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: () => fetch("/api/inbox").then((r) => r.json()),
  });
}

export function useSendChat(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      fetch(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", slug] });
    },
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeIds: string[]) =>
      fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeIds }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useApprovePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      fetch(`/api/inbox/${planId}/approve`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useRejectPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      fetch(`/api/inbox/${planId}/reject`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes: string; category?: string }) =>
      fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });
}
