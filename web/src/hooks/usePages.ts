import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PageSummary {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  lastModifiedBy: string;
  parent?: string;
  overview?: boolean;
}

interface WikiPage extends PageSummary {
  content: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export function usePageList() {
  return useQuery<PageSummary[]>({
    queryKey: ["pages"],
    queryFn: () => fetchJson("/api/pages"),
  });
}

export function usePage(slug: string) {
  return useQuery<WikiPage>({
    queryKey: ["page", slug],
    queryFn: () => fetchJson(`/api/pages/${slug}`),
    enabled: !!slug,
  });
}

export function useFeed() {
  return useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchJson("/api/feed"),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: () => fetchJson("/api/inbox"),
  });
}

export function useSendChat(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      fetchJson(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", slug] });
    },
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changeIds: string[]) =>
      fetchJson("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useApprovePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      fetchJson(`/api/inbox/${planId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useRejectPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      fetchJson(`/api/inbox/${planId}/reject`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

interface Taxonomy {
  categories: string[];
  tags: Record<string, string>;
}

export function useTaxonomy() {
  return useQuery<Taxonomy>({
    queryKey: ["taxonomy"],
    queryFn: () => fetchJson("/api/taxonomy"),
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes: string; category?: string }) =>
      fetchJson("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });
}
