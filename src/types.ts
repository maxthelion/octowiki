export interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  lastModifiedBy: "user" | "agent";
  lastSummarised?: string;
  content: string;
  parent?: string;
  overview?: boolean;
}

export interface PageFrontmatter {
  title: string;
  category: string;
  tags: string[];
  summary: string;
  "last-summarised"?: string;
  "last-modified-by": "user" | "agent";
  parent?: string;
  overview?: boolean;
}

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

export interface ChatExchange {
  timestamp: string;
  role: "user" | "agent";
  message: string;
  pageDiff?: string;
}

export interface PageMeta {
  page: string;
  history: ChatExchange[];
}

export interface WikiLink {
  raw: string;
  type: "link" | "embed" | "full-embed" | "src" | "ref";
  target: string;
  anchor?: string;
  refType?: "git" | "pr" | "doc" | "test";
}

export interface SSEEvent {
  type: "page-changed" | "feed-updated" | "plan-status-changed";
  slug?: string;
  planId?: string;
}

export interface TagUndoEntry {
  timestamp: string;
  page: string;
  previousTags: string[];
  newTags: string[];
}
