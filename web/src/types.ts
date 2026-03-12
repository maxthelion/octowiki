export interface ChangeSummary {
  id: string;
  timestamp: string;
  page: string;
  tags: string[];
  summary: string;
  affectedPages: string[];
  rawDiff: string;
}

export interface Plan {
  id: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "done" | "failed";
  summary: string;
  steps: PlanStep[];
  error?: string;
}

export interface PlanStep {
  description: string;
  target: string;
  action: "create" | "update" | "delete";
}

export interface SearchResult {
  slug?: string;
  id?: string;
  title?: string;
  summary?: string;
}
