/**
 * A small HTML to markdown converter for the site's own server-rendered pages,
 * which are well formed: every tag is closed, or void, or ends in "/>". It keeps
 * headings, paragraphs, lists, links, inline code and blocks of code, and drops
 * what a reader of the text would not see or use: SVG, scripts, buttons (but a
 * button that is a heading's text, as a question that opens its answer), form
 * fields, images, hidden parts and anything marked `data-llms="skip"`.
 */

type Element = { tag: string; attrs: Record<string, string>; children: Node[] };
type Node = Element | string;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);
const DROP = new Set(["svg", "script", "style", "button", "template", "noscript", "img", "input", "textarea", "select", "iframe", "canvas", "video", "audio"]);
const INLINE = new Set(["a", "abbr", "b", "bdi", "br", "cite", "code", "data", "dfn", "em", "i", "kbd", "label", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr"]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") return String.fromCodePoint(name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** The HTML as a tree of elements and text. */
export function parseHtml(html: string): Element {
  const root: Element = { tag: "#root", attrs: {}, children: [] };
  const open: Element[] = [root];
  const token = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+|</g;
  for (let match = token.exec(html); match; match = token.exec(html)) {
    const [whole, closing, opening, rest = "", selfClosing] = match;
    const parent = open[open.length - 1] as Element;
    if (whole.startsWith("<!--")) continue;
    if (closing) {
      const at = open.map((element) => element.tag).lastIndexOf(closing.toLowerCase());
      if (at > 0) open.length = at;
    } else if (opening) {
      const attrs: Record<string, string> = {};
      for (const [, name, value] of rest.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) attrs[(name as string).toLowerCase()] = decode(value ?? "");
      const element: Element = { tag: opening.toLowerCase(), attrs, children: [] };
      parent.children.push(element);
      if (RAW.has(element.tag)) {
        const end = html.toLowerCase().indexOf(`</${element.tag}`, token.lastIndex);
        token.lastIndex = end < 0 ? html.length : end;
      } else if (!selfClosing && !VOID.has(element.tag)) open.push(element);
    } else parent.children.push(decode(whole));
  }
  return root;
}

/** The first element under `node` with this tag, if any. */
export function findElement(node: Element, tag: string): Element | null {
  for (const child of node.children) {
    if (typeof child === "string") continue;
    if (child.tag === tag) return child;
    const found = findElement(child, tag);
    if (found) return found;
  }
  return null;
}

function dropped(node: Node) {
  if (typeof node === "string") return false;
  const classes = (node.attrs.class ?? "").split(/\s+/);
  return DROP.has(node.tag) || node.attrs["aria-hidden"] === "true" || node.attrs["data-llms"] === "skip" || "hidden" in node.attrs || classes.includes("visually-hidden");
}

const isInline = (node: Node) => typeof node === "string" || INLINE.has(node.tag);
const squash = (text: string) => text.replace(/\s+/g, " ");

function textOf(node: Node): string {
  if (dropped(node)) return "";
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}

function inline(nodes: Node[], base: string): string {
  return nodes
    .map((node) => {
      if (dropped(node)) return "";
      if (typeof node === "string") return squash(node);
      if (node.tag === "br") return " ";
      if (node.tag === "code" || node.tag === "kbd" || node.tag === "samp") {
        const code = squash(textOf(node)).trim();
        return code ? `\`${code}\`` : "";
      }
      if (node.tag === "a") {
        const href = node.attrs.href;
        const label = linkParts(node.children, base).join(": ");
        if (!label) return "";
        return href ? `[${label}](${new URL(href, base).href})` : label;
      }
      const inner = inline(node.children, base);
      if (node.tag === "strong" || node.tag === "b") return inner.trim() ? `**${inner.trim()}**` : "";
      if (node.tag === "em" || node.tag === "i") return inner.trim() ? `_${inner.trim()}_` : "";
      // A block inside a link, as a card's title and its line, still reads as separate words.
      return INLINE.has(node.tag) ? inner : ` ${inner} `;
    })
    .join("");
}

/** A link's text, one part per block inside it, so a card's title and its line read "Title: line". */
function linkParts(nodes: Node[], base: string): string[] {
  const parts: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = squash(inline(run, base)).trim();
    if (text) parts.push(text);
    run = [];
  };
  for (const node of nodes) {
    if (typeof node === "string" || dropped(node) || INLINE.has(node.tag)) run.push(node);
    else {
      flush();
      parts.push(...linkParts(node.children, base));
    }
  }
  flush();
  return parts;
}

const fence = (text: string, language = "") => `\`\`\`${language}\n${text.trim()}\n\`\`\``;

/** A run of inline nodes as one block: a block of code when it is only a code element, else a paragraph. */
function paragraph(nodes: Node[], base: string): string[] {
  const shown = nodes.filter((node) => !dropped(node) && !(typeof node === "string" && !node.trim()));
  const [only] = shown;
  if (shown.length === 1 && only && typeof only !== "string" && only.tag === "code") return [fence(squash(textOf(only)))];
  const text = squash(inline(nodes, base)).trim();
  return text ? [text] : [];
}

function listItems(list: Element, base: string): string {
  const ordered = list.tag === "ol";
  const items = list.children
    .filter((child): child is Element => typeof child !== "string" && child.tag === "li" && !dropped(child))
    .map((item, at) => {
      const marker = ordered ? `${at + 1}. ` : "- ";
      const indent = " ".repeat(marker.length);
      const body = blocks(item.children, base).join("\n\n");
      return marker + body.split("\n").map((line, row) => (row === 0 || !line ? line : indent + line)).join("\n");
    });
  // A list whose items hold more than one line gets a blank line between them.
  return items.join(items.some((item) => item.includes("\n")) ? "\n\n" : "\n");
}

function block(node: Element, base: string): string[] {
  const heading = /^h([1-6])$/.exec(node.tag);
  if (heading) {
    const unwrapped = node.children.flatMap((child) => (typeof child !== "string" && child.tag === "button" ? child.children : [child]));
    const text = squash(inline(unwrapped, base)).trim();
    return text ? [`${"#".repeat(Number(heading[1]))} ${text}`] : [];
  }
  if (node.tag === "p") return paragraph(node.children, base);
  if (node.tag === "ul" || node.tag === "ol") {
    const list = listItems(node, base);
    return list ? [list] : [];
  }
  if (node.tag === "pre") return [fence(textOf(node))];
  if (node.tag === "hr") return ["---"];
  if (node.tag === "figure") {
    const caption = node.children.find((child): child is Element => typeof child !== "string" && child.tag === "figcaption");
    if (caption) {
      const body = node.children.filter((child) => child !== caption).map(textOf).join("\n");
      const title = inline(caption.children, base).trim();
      return [...(title ? [`${title}:`] : []), fence(squash(body))];
    }
  }
  return blocks(node.children, base);
}

function blocks(nodes: Node[], base: string): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  for (const node of nodes) {
    if (dropped(node)) continue;
    if (isInline(node)) {
      run.push(node);
      continue;
    }
    out.push(...paragraph(run, base));
    run = [];
    out.push(...block(node as Element, base));
  }
  out.push(...paragraph(run, base));
  return out;
}

/** The markdown for `html`, or for its first `within` element when one is given. Links are made absolute against `base`. */
export function htmlToMarkdown(html: string, { base, within }: { base: string; within?: string }): string {
  const root = parseHtml(html);
  const start = within ? findElement(root, within) : root;
  if (!start) throw new Error(`The HTML has no <${within}>`);
  return `${blocks(start.children, base).join("\n\n")}\n`;
}
