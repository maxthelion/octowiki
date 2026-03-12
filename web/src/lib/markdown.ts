import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: true, linkify: true });

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

  if (inner.startsWith("!!")) {
    const target = inner.slice(2);
    return `<div class="wiki-embed wiki-embed-full" data-target="${target}"><a href="/page/${target}">${target}</a> (full embed)</div>`;
  }

  if (inner.startsWith("!")) {
    const target = inner.slice(1);
    return `<div class="wiki-embed" data-target="${target}"><a href="/page/${target}">${target}</a></div>`;
  }

  if (inner.startsWith("src:")) {
    const rest = inner.slice(4);
    const [file, anchor] = rest.split("#");
    return `<code class="wiki-src" data-file="${file}" data-anchor="${anchor ?? ""}">${file}${anchor ? `#${anchor}` : ""}</code>`;
  }

  if (inner.startsWith("ref:")) {
    const rest = inner.slice(4);
    const [type, ...targetParts] = rest.split(":");
    const target = targetParts.join(":");
    return `<span class="wiki-ref" data-type="${type}" data-target="${target}">${type}:${target}</span>`;
  }

  return `<a href="/page/${inner}" class="wiki-link" data-target="${inner}">${inner}</a>`;
};

export function renderMarkdown(content: string): string {
  return md.render(content);
}
