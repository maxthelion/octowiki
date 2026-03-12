---
name: octowiki-add-page
description: Use when adding a new page to the OctoWiki wiki. Triggered by /octowiki:add-page or when user asks to create/add a wiki page.
---

# Add Wiki Page

Add a new page to the OctoWiki wiki at `wiki/pages/`.

## Usage

```
/octowiki:add-page <prompt>
```

The prompt becomes the page content. You fill in the rest.

## Steps

1. **Read existing pages** to understand categories and avoid slug collisions:
   ```bash
   ls wiki/pages/
   ```

2. **Derive from the prompt:**
   - **slug**: kebab-case, max 60 chars, descriptive (e.g. `api-rate-limiting`)
   - **title**: Human-readable version of the topic
   - **category**: One of the canonical categories from the spec: `architecture`, `pipeline`, `data-model`, `rendering`, `testing`, `observability`, `decisions`, `meta`, `ui`, `functionality`. Pick the best fit.
   - **tags**: 2-5 relevant tags
   - **summary**: One sentence describing the page

3. **Write the page** to `wiki/pages/<slug>.md`:

   ```markdown
   ---
   title: "<title>"
   category: "<category>"
   tags: [tag1, tag2, tag3]
   summary: "<one sentence summary>"
   last-modified-by: user
   ---

   <structured content from the user's prompt>
   ```

4. **Structure the content**: Don't just dump the prompt verbatim. Organize it with headings, lists, and sections as appropriate. Preserve all the user's information but make it readable as a wiki page. Add `[[wikilinks]]` to other pages where relevant.

5. **Confirm**: Tell the user the page was created and its path.

## Rules

- Always set `last-modified-by: user`
- Never overwrite an existing page — if the slug exists, append a number
- Keep slugs short and descriptive
- Cross-reference other wiki pages with `[[slug]]` syntax where relevant
- The user's content goes at the end of any structure you add
