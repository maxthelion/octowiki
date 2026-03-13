---
title: "Configuration & Environment Variables"
category: data-model
tags: [configuration, environment, setup, api-key]
summary: "The environment variables that control OctoWiki's runtime behaviour, including the required Anthropic API key and optional overrides for the wiki directory and HTTP port."
last-modified-by: agent
---

## Overview

OctoWiki is configured entirely through environment variables. There are no config files — values are read at startup from the process environment or from a `.env` file in the project root (loaded automatically by Bun).

## Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `ANTHROPIC_API_KEY` | — | Yes | Anthropic API key used by skills and the batch-import pipeline |
| `OCTOWIKI_DIR` | `./wiki` | No | Path to the wiki content directory |
| `PORT` | `4567` | No | HTTP port the server listens on |

### `ANTHROPIC_API_KEY`

Required. Used by all AI-assisted features — page synthesis, topic extraction, and the [[skills]] that call Claude. Obtain a key from [console.anthropic.com](https://console.anthropic.com/).

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### `OCTOWIKI_DIR`

Optional. The directory where wiki pages are stored on disk. Defaults to `./wiki` relative to the working directory. Change this to point at an existing wiki or to isolate content per project.

```bash
export OCTOWIKI_DIR=/path/to/your/wiki
```

The directory must exist before starting the server. The page files inside it follow the format described in [[content-guidelines]].

### `PORT`

Optional. The TCP port the HTTP server binds to. Defaults to `4567`. The frontend dev proxy targets this port when running `bun run dev:web`.

```bash
export PORT=5000
```

## Using a `.env` File

Bun automatically loads a `.env` file from the project root, so variables do not need to be exported in the shell. A minimal `.env` looks like:

```env
ANTHROPIC_API_KEY=sk-ant-...
OCTOWIKI_DIR=./wiki
PORT=4567
```

Do not commit `.env` to version control — it contains the API key.

## Related

- [[bootstrapping]] — uses `OCTOWIKI_DIR` to locate where generated pages are written
- [[skills]] — skills that call Claude require `ANTHROPIC_API_KEY` to be set
