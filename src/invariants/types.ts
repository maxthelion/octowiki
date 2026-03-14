export interface InvariantNode {
  id: string;           // dotted path, e.g. "agent-pipeline.watcher.debounce"
  parent: string | null;
  description: string;
  kind: "behavioural" | "architectural";
  verificationMethod: "unit-test" | "integration-test" | "visual-qa" | "manual-check" | "static-analysis";
  sources: string[];    // wiki page slugs
}

export interface InvariantTree {
  extractedAt: string;  // ISO 8601
  invariants: InvariantNode[];
}

export interface EvidenceEntry {
  invariantId: string;
  implemented: boolean;
  tested: boolean;
  codeLocations: string[];
  testLocations: string[];
}

export interface UnspecifiedInvariant {
  description: string;
  codeLocations: string[];
  testLocations: string[];
}

export interface EvidenceReport {
  extractedAt: string;
  evidence: EvidenceEntry[];
  unspecified: UnspecifiedInvariant[];
}

export type InvariantStatus =
  | "implemented-tested"
  | "implemented-untested"
  | "specified-only"
  | "unspecified";

export interface ResolvedInvariant {
  id: string;
  parent: string | null;
  description: string;
  kind: "behavioural" | "architectural";
  verificationMethod: string;
  sources: string[];
  status: InvariantStatus;
  codeLocations: string[];
  testLocations: string[];
}

export interface ComparisonReport {
  generatedAt: string;
  groups: {
    name: string;
    coverage: number;    // 0.0-1.0
    invariants: ResolvedInvariant[];
  }[];
  unspecified: UnspecifiedInvariant[];
  summary: {
    total: number;
    implementedTested: number;
    implementedUntested: number;
    specifiedOnly: number;
    unspecified: number;
  };
}
