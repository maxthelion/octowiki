import type { WikiLink } from "../types";

const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

export function parseWikilinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  const re = new RegExp(WIKILINK_PATTERN.source, WIKILINK_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const inner = match[1];
    links.push(parseOne(raw, inner));
  }

  return links;
}

function parseOne(raw: string, inner: string): WikiLink {
  if (inner.startsWith("!!")) {
    return { raw, type: "full-embed", target: inner.slice(2) };
  }
  if (inner.startsWith("!")) {
    return { raw, type: "embed", target: inner.slice(1) };
  }
  if (inner.startsWith("src:")) {
    const rest = inner.slice(4);
    const hashIdx = rest.indexOf("#");
    if (hashIdx !== -1) {
      return { raw, type: "src", target: rest.slice(0, hashIdx), anchor: rest.slice(hashIdx + 1) };
    }
    return { raw, type: "src", target: rest };
  }
  if (inner.startsWith("ref:")) {
    const rest = inner.slice(4);
    const colonIdx = rest.indexOf(":");
    if (colonIdx !== -1) {
      const refType = rest.slice(0, colonIdx) as WikiLink["refType"];
      const remainder = rest.slice(colonIdx + 1);
      const hashIdx = remainder.indexOf("#");
      if (hashIdx !== -1) {
        return { raw, type: "ref", refType, target: remainder.slice(0, hashIdx), anchor: remainder.slice(hashIdx + 1) };
      }
      return { raw, type: "ref", refType, target: remainder };
    }
  }
  return { raw, type: "link", target: inner };
}
