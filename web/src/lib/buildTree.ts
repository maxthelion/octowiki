interface PageSummary {
  slug: string;
  title: string;
  category: string;
  parent?: string;
  overview?: boolean;
  tags: string[];
  summary: string;
  lastModifiedBy: string;
}

export interface TreeNodeData {
  page: PageSummary;
  children: TreeNodeData[];
}

export function buildTree(pages: PageSummary[]): TreeNodeData[] {
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  const childrenMap = new Map<string | undefined, PageSummary[]>();

  for (const page of pages) {
    const parentSlug = page.parent && bySlug.has(page.parent) ? page.parent : undefined;

    let effectiveParent = parentSlug;
    if (parentSlug) {
      // Cycle detection: walk ancestor chain
      const visited = new Set<string>();
      let current: string | undefined = parentSlug;
      while (current) {
        if (current === page.slug || visited.has(current)) {
          effectiveParent = undefined;
          break;
        }
        visited.add(current);
        const parentPage = bySlug.get(current);
        current = parentPage?.parent && bySlug.has(parentPage.parent) ? parentPage.parent : undefined;
      }
    }

    const list = childrenMap.get(effectiveParent) ?? [];
    list.push(page);
    childrenMap.set(effectiveParent, list);
  }

  function sortPages(list: PageSummary[]): PageSummary[] {
    return [...list].sort((a, b) => {
      if (a.overview && !b.overview) return -1;
      if (!a.overview && b.overview) return 1;
      return (a.title || a.slug).localeCompare(b.title || b.slug);
    });
  }

  function buildNodes(parentSlug: string | undefined): TreeNodeData[] {
    const children = childrenMap.get(parentSlug) ?? [];
    return sortPages(children).map(page => ({
      page,
      children: buildNodes(page.slug),
    }));
  }

  return buildNodes(undefined);
}
