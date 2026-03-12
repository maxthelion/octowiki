import type {
  MapOutput,
  GroupExtract,
  GroupsOutput,
  NewPageGroup,
  MergeGroup,
  SkippedFile,
} from "./types";

const CONFIDENCE_THRESHOLD = 0.3;

export function groupMapOutputs(
  mapOutputs: MapOutput[],
  existingPages: Record<string, string>,
  fileDates: Record<string, string> = {}
): GroupsOutput {
  const slugBuckets = new Map<string, {
    extracts: GroupExtract[];
    allTags: string[];
    bestCategory: string;
    bestConfidence: number;
    isMerge: boolean;
  }>();
  const skipped: SkippedFile[] = [];

  for (const output of mapOutputs) {
    if (output.topics.length === 0 && output.skipped) {
      skipped.push({ source: output.file, reason: output.skipped });
      continue;
    }

    const mergeSlugs = new Set(
      output.existingOverlaps
        .filter((o) => o.recommendation === "merge_into_existing")
        .map((o) => o.existingSlug)
    );
    const skipSlugs = new Set(
      output.existingOverlaps
        .filter((o) => o.recommendation === "skip")
        .map((o) => o.existingSlug)
    );

    for (const topic of output.topics) {
      if (skipSlugs.has(topic.suggestedSlug)) {
        skipped.push({
          source: output.file,
          reason: `Overlap with existing "${topic.suggestedSlug}" — recommended skip`,
        });
        continue;
      }

      if (topic.confidence < CONFIDENCE_THRESHOLD) {
        skipped.push({
          source: output.file,
          reason: `Low confidence (${topic.confidence}) for topic "${topic.topic}"`,
        });
        continue;
      }

      const slug = topic.suggestedSlug;
      const isMerge = mergeSlugs.has(slug) || slug in existingPages;

      if (!slugBuckets.has(slug)) {
        slugBuckets.set(slug, {
          extracts: [],
          allTags: [],
          bestCategory: topic.category,
          bestConfidence: topic.confidence,
          isMerge,
        });
      }

      const bucket = slugBuckets.get(slug)!;
      bucket.extracts.push({
        source: output.file,
        date: fileDates[output.file] ?? "",
        content: topic.content,
        tags: topic.tags,
        confidence: topic.confidence,
      });

      for (const tag of topic.tags) {
        if (!bucket.allTags.includes(tag)) {
          bucket.allTags.push(tag);
        }
      }

      if (topic.confidence > bucket.bestConfidence) {
        bucket.bestCategory = topic.category;
        bucket.bestConfidence = topic.confidence;
      }

      if (isMerge) bucket.isMerge = true;
    }
  }

  const newPages: NewPageGroup[] = [];
  const mergeIntoExisting: MergeGroup[] = [];

  for (const [slug, bucket] of slugBuckets) {
    bucket.extracts.sort((a, b) => b.date.localeCompare(a.date));

    if (bucket.isMerge) {
      mergeIntoExisting.push({
        slug,
        existingContent: existingPages[slug] ?? "",
        extracts: bucket.extracts,
        allTags: bucket.allTags,
      });
    } else {
      newPages.push({
        slug,
        category: bucket.bestCategory,
        extracts: bucket.extracts,
        allTags: bucket.allTags,
      });
    }
  }

  return { newPages, mergeIntoExisting, skipped };
}
