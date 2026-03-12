import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true });

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

md.inline.ruler.push("wikilink", (state, silent) => {
  const src = state.src;
  const pos = state.pos;

  if (src.charCodeAt(pos) !== 0x5b || src.charCodeAt(pos + 1) !== 0x5b) return false;

  const end = src.indexOf("]]", pos + 2);
  if (end === -1) return false;

  if (!silent) {
    const inner = src.slice(pos + 2, end);
    const token = state.push("wikilink", "", 0);
    token.content = inner;
  }

  state.pos = end + 2;
  return true;
});

md.renderer.rules.wikilink = (tokens, idx) => {
  const inner = tokens[idx].content;
  const safe = escapeHtml(inner);

  if (inner.startsWith("!!")) {
    const target = escapeHtml(inner.slice(2));
    return `<div class="wiki-embed wiki-embed-full" data-target="${target}"><a href="/page/${target}">${target}</a> (full embed)</div>`;
  }

  if (inner.startsWith("!")) {
    const target = escapeHtml(inner.slice(1));
    return `<div class="wiki-embed" data-target="${target}"><a href="/page/${target}">${target}</a></div>`;
  }

  if (inner.startsWith("src:")) {
    const rest = inner.slice(4);
    const [file, anchor] = rest.split("#");
    return `<code class="wiki-src" data-file="${escapeHtml(file)}" data-anchor="${escapeHtml(anchor ?? "")}">${escapeHtml(file)}${anchor ? `#${escapeHtml(anchor)}` : ""}</code>`;
  }

  if (inner.startsWith("ref:")) {
    const rest = inner.slice(4);
    const [type, ...targetParts] = rest.split(":");
    const target = targetParts.join(":");
    return `<span class="wiki-ref" data-type="${escapeHtml(type)}" data-target="${escapeHtml(target)}">${escapeHtml(type)}:${escapeHtml(target)}</span>`;
  }

  return `<a href="/page/${safe}" class="wiki-link" data-target="${safe}">${safe}</a>`;
};

export function renderMarkdown(content: string): string {
  return md.render(content);
}
