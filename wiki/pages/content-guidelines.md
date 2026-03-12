---
title: Content Guidelines
category: meta
tags: [guidelines, content, duplication, single-source-of-truth, wikilinks]
summary: Rules for writing wiki content — every concept has one canonical page, everything else links to it.
last-modified-by: user
---

## Core Principle

**Every concept has exactly one page where it is described. Everywhere else links to that page.**

This is the wiki equivalent of DRY. If something is explained in two places, they will drift apart. One will be updated and the other won't. The reader won't know which is current.

## Rules

### 1. One Description, Many References

When a topic has its own page, other pages should not re-describe it. They should:

- Link to it: `[[page-slug]]`
- State the relationship briefly: "The bootstrapping process uses categories — see [[category-taxonomy]] for details"
- Not duplicate the how/why/what

**Bad:** The [[category-taxonomy]] page explains in detail how categories are used during bootstrapping (file scanning, multi-category matching, content guidelines per category).

**Good:** The [[category-taxonomy]] page defines the categories. [[bootstrapping]] describes how they are used during wiki population.

### 2. Canonical Ownership

Each concept is owned by the page where it most naturally belongs:

| Concept | Canonical Page |
|---------|---------------|
| What categories are and their content guidelines | [[category-taxonomy]] |
| How bootstrapping works | [[bootstrapping]] |
| How the add-page skill works | [[skills]] |
| How the sidebar tree works | [[sidebar-tree-navigation]] |

If you're writing about a concept and find yourself going into detail, ask: "Does this concept already have a page?" If yes, link. If no, consider creating one.

### 3. Summaries Are OK, Details Are Not

A one-sentence summary of a linked concept is fine for flow:

> "During bootstrapping, each source file is matched against the [[category-taxonomy]] to determine which pages it should contribute to."

Reproducing the category list, their descriptions, and their content guidelines is not:

> ~~"The architecture category is for system structure and design. Pages should contain component relationships, key interfaces..."~~

That belongs on the taxonomy page and nowhere else.

### 4. When To Create a New Page vs Link

- If you're writing more than 2-3 sentences about a sub-topic, it probably deserves its own page
- If you're about to paste content from another page, stop and link instead
- If a section heading in your page matches the title of another page, replace the section with a link

## Applying This

### Existing Pages to Clean Up

- [[category-taxonomy]] — the "Usage in Bootstrapping" section should be shortened to a reference to [[bootstrapping]]
- [[category-taxonomy]] — the "Usage in the Add Page Skill" section should be shortened to a reference to [[skills]]
- [[skills]] — should not reproduce the category-matching logic; link to [[category-taxonomy]]

### For the Add Page Skill

When `/octowiki:add-page` creates a page, it should follow these guidelines:
- Check if the concept already has a page before creating a new one
- Use `[[wikilinks]]` to reference related pages rather than re-explaining them
- Keep descriptions focused on what's unique to this page

## Related

- [[category-taxonomy]] — canonical category definitions
- [[bootstrapping]] — how wiki content is populated
- [[skills]] — automation tools for the wiki
