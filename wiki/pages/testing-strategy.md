---
title: Testing Strategy
category: testing
tags: [testing, bun, mocking, integration-tests, quality]
summary: "OctoWiki's layered testing approach using Bun's native test runner, covering unit tests for core logic, integration tests for pipelines, and a deliberate decision to skip browser e2e tests in v1."
last-modified-by: agent
---

## Overview

OctoWiki uses a focused, layered testing approach built on Bun's native test runner. The strategy prioritises unit tests for pure logic and integration tests for data pipelines, while intentionally omitting end-to-end browser tests in v1. This balance catches logic errors early, verifies that pipelines work end-to-end, and avoids the overhead of a full browser automation stack.

All tests are run with:

```sh
bun test
```

Bun automatically discovers files matching `*.test.ts` and `*.spec.ts` patterns and provides built-in `expect`-based assertions — no additional test framework is required.

## Writing Tests

Tests use the `bun:test` module:

```ts
import { test, expect } from "bun:test";

test("parses frontmatter", () => {
  expect(parseFrontmatter("---\ntitle: Foo\n---")).toEqual({ title: "Foo" });
});
```

Bun's test runner is API-compatible with Jest for basic usage (`test`, `expect`, `describe`, `beforeEach`, `afterEach`), so standard patterns apply.

## Unit Tests

Unit tests target isolated logic with no I/O or external dependencies. The following areas have dedicated unit test coverage:

| Area | What is tested |
|------|----------------|
| Frontmatter parsing | YAML extraction, field updates, round-trip fidelity |
| Wikilink parsing | All 8 syntax variants (bare, aliased, anchored, etc.) |
| Backlinks computation | Relationship derivation from link graph |
| Debounce logic | Timer accuracy, event batching behaviour |
| Lock management | PID checks, acquisition and release under contention |

Unit tests run fast and are the first line of defence against regressions in core logic.

## Integration Tests

Integration tests verify that full pipelines behave correctly end-to-end. Each test exercises a meaningful slice of the system using real file system operations and mocked external services:

| Pipeline | What is verified |
|----------|------------------|
| Watcher → Haiku | File change triggers AI enrichment (mocked Anthropic API) |
| Chat flow | User input → agent call → page written to disk |
| Plan approval → execution | Approval event → branch creation → status tracking |
| Add page workflow | User input → agent structuring → index updated |

The [[skills]] and [[bootstrapping]] workflows are covered by integration tests that exercise the full discover → group → synthesise pipeline.

## Mocking Strategy

External dependencies are mocked to keep tests fast, deterministic, and free of API costs:

- **Anthropic API** — mocked entirely; no real LLM calls during CI. This avoids cost and latency while still verifying the integration contract.
- **qmd CLI** — mocked or replaced with a temporary in-memory database.
- **File system** — real file system operations using a temporary directory, so path resolution and file watching behave as in production.
- **Git operations** — real git, using a shallow clone for speed.

Using a real file system and real git distinguishes OctoWiki's integration tests from pure unit tests — they catch issues in file-watching, lock contention, and git branching that mocks would hide.

## Browser Testing

There are no end-to-end browser tests in v1. The rationale:

- React components are kept thin and presentational; they contain no logic to test.
- The API layer is fully covered by integration tests.
- Browser automation tooling (Playwright, Puppeteer) adds significant setup and maintenance cost.
- Manual testing during development is sufficient at this stage.

This decision is revisited as the UI grows in complexity. The component boundary is the natural seam — if a component ever contains meaningful logic, it becomes a unit test target.

## Coverage Gaps and Known Limitations

- No automated tests for the markdown renderer or syntax highlighting (covered by manual testing).
- Wikilink rendering in the React layer is trusted to be thin; not currently integration-tested.
- Mocked Anthropic API means prompt quality and model output format are not regression-tested automatically.

## Related

- [[skills]] — the add-page and batch-import skills have integration test coverage
- [[bootstrapping]] — the discover → group pipeline is tested end-to-end
