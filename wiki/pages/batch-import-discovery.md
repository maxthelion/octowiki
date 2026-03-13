---
title: "Batch Import: Discovery Phase"
category: pipeline
tags: [batch-import, discovery, manifest, file-scanning]
summary: "The discovery phase scans a repository for markdown files and writes a manifest JSON to a temp directory, providing the input for all subsequent batch import phases."
last-modified-by: agent
---

## Overview

The discovery phase is the first step of the [[bootstrapping]] batch import pipeline. It is a pure Bun script with no LLM calls — its job is deterministic file scanning: find all markdown files in a repository, collect metadata, and produce a `manifest.json` that downstream phases consume.

The script lives at `src/batch-import/discover.ts` and is available as a standalone command.

## Trigger

The phase is triggered either:

- Directly via CLI: `bun run src/batch-import/discover.ts <repo-path> [--force]`
- Via the npm script alias: `bun run discover /path/to/repo`
- Implicitly when the full batch import skill is invoked — see [[bootstrapping]]

**Input:** A repository path (defaults to the current working directory).

**Output:** A `manifest.json` file written to `/tmp/octowiki-import-XXXX/`, with the temp directory path printed to stdout.

## Processing Steps

1. Walk the repository tree starting from the given `repoPath`.
2. **Skip directories:** `node_modules`, `.git`, `dist`, `wiki`, `.meta`, `.index`.
3. For each `.md` file found:
   - Skip if the file is empty.
   - Skip if the file exceeds 100 KB (logs a warning).
   - Read full content.
   - Retrieve the last-modified date via `git log -1 --format=%aI -- <file>`; fall back to filesystem `mtime` for untracked files or non-git repos.
4. Collect all passing files into a `ManifestFile` array.
5. Create a temp directory `/tmp/octowiki-import-XXXX/` with the following subdirectories:
   - `map/` — outputs from the map phase
   - `reduce/` and `reduce2/` — outputs from the reduce phase
   - `wiki/pages/` — staged wiki pages ready for preview
   - `merges/` — merge diffs for existing pages
6. If more than 200 files are found and `--force` is not passed, prompt the user for confirmation before proceeding.
7. Write `manifest.json` to the temp directory root.

## Output Format

The manifest is a JSON file with the following shape:

```json
{
  "repoPath": "/path/to/repo",
  "createdAt": "2026-03-12T11:30:00Z",
  "tmpDir": "/tmp/octowiki-import-a1b2c3",
  "files": [
    {
      "path": "/path/to/repo/docs/auth.md",
      "relativePath": "docs/auth.md",
      "lastModified": "2026-02-15T10:30:00Z",
      "sizeBytes": 2340,
      "content": "# Authentication\n..."
    }
  ]
}
```

The TypeScript types for `Manifest` and `ManifestFile` are defined in `src/batch-import/types.ts`.

## Safety Guards

| Guard | Behaviour |
|---|---|
| 100 KB size limit | Files exceeding this are skipped with a logged warning |
| Empty file skip | Files with no content are ignored silently |
| Large batch guard | >200 files requires `--force` flag or interactive confirmation |

## Error Handling

- If `git log` fails or returns nothing, the script falls back to the filesystem `mtime`. This ensures the phase works on non-git repos and newly created untracked files.
- No partial manifests are written — the file is only created once the full scan completes.

## Dependencies

- Bun runtime (uses `Bun.file`, `Bun.$` for shell commands)
- Git (optional — used for accurate `lastModified` dates)
- No LLM calls; no network access

Downstream phases that consume the manifest: the map phase (topic extraction) and, transitively, the group and reduce phases. See [[bootstrapping]] for the full pipeline.
