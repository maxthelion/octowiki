export interface ManifestFile {
  path: string;
  relativePath: string;
  lastModified: string; // ISO 8601
  sizeBytes: number;
  content: string;
}

export interface Manifest {
  repoPath: string;
  createdAt: string;
  tmpDir: string;
  files: ManifestFile[];
}

export interface TopicExtract {
  topic: string;
  suggestedSlug: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  confidence: number;
}

export interface ExistingOverlap {
  topic: string;
  existingSlug: string;
  overlapLevel: "high" | "medium" | "low";
  recommendation: "merge_into_existing" | "create_new" | "skip";
}

export interface MapOutput {
  file: string;
  topics: TopicExtract[];
  existingOverlaps: ExistingOverlap[];
  skipped: string;
}

export interface GroupExtract {
  source: string;
  date: string;
  content: string;
  tags: string[];
  confidence: number;
}

export interface NewPageGroup {
  slug: string;
  category: string;
  extracts: GroupExtract[];
  allTags: string[];
}

export interface MergeGroup {
  slug: string;
  existingContent: string;
  extracts: GroupExtract[];
  allTags: string[];
}

export interface SkippedFile {
  source: string;
  reason: string;
}

export interface GroupsOutput {
  newPages: NewPageGroup[];
  mergeIntoExisting: MergeGroup[];
  skipped: SkippedFile[];
}

export interface NewPageReduceOutput {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
}

export interface MergeReduceOutput {
  slug: string;
  action: "update";
  title: string;
  category: string;
  tags: string[];
  summary: string;
  content: string;
  changelog: string;
}
