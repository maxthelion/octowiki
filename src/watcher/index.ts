import { watch, type FSWatcher } from "fs";
import { join } from "path";

export interface DualDebouncerOpts {
  fastDelayMs: number;
  slowDelayMs: number;
  onFast: (files: string[]) => void;
  onSlow: (files: string[]) => void;
}

export function createDualDebouncer(opts: DualDebouncerOpts) {
  let fastTimer: ReturnType<typeof setTimeout> | null = null;
  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  let fastPending: Set<string> = new Set();
  let slowPending: Set<string> = new Set();

  function trigger(file: string) {
    fastPending.add(file);
    slowPending.add(file);

    if (fastTimer) clearTimeout(fastTimer);
    fastTimer = setTimeout(() => {
      const files = [...fastPending];
      fastPending.clear();
      opts.onFast(files);
    }, opts.fastDelayMs);

    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      const files = [...slowPending];
      slowPending.clear();
      opts.onSlow(files);
    }, opts.slowDelayMs);
  }

  function stop() {
    if (fastTimer) clearTimeout(fastTimer);
    if (slowTimer) clearTimeout(slowTimer);
  }

  return { trigger, stop };
}

export function startWatcher(opts: {
  wikiDir: string;
  onSSE: (files: string[]) => void;
  onHaiku: (files: string[]) => void;
}): { stop: () => void } {
  const pagesDir = join(opts.wikiDir, "pages");
  const metaDir = join(opts.wikiDir, "meta");
  const watchers: FSWatcher[] = [];

  const debouncer = createDualDebouncer({
    fastDelayMs: 2_000,
    slowDelayMs: 30_000,
    onFast: opts.onSSE,
    onSlow: opts.onHaiku,
  });

  try {
    const pagesWatcher = watch(pagesDir, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith(".md")) {
        debouncer.trigger(join("pages", filename));
      }
    });
    watchers.push(pagesWatcher);
  } catch (e) {
    console.warn("Could not watch pages directory:", e);
  }

  try {
    const metaWatcher = watch(metaDir, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith(".md")) {
        debouncer.trigger(join("meta", filename));
      }
    });
    watchers.push(metaWatcher);
  } catch (e) {
    console.warn("Could not watch meta directory:", e);
  }

  return {
    stop: () => {
      debouncer.stop();
      watchers.forEach((w) => w.close());
    },
  };
}
