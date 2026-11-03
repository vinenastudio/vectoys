import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PAGES, type Page } from "../src/pages";
import type { RegistryIndex } from "../src/registry";
import { INDEX_DATA } from "../src/registry";
import { llmsFullText, pageMarkdown } from "./agent-files";

// Draws each page into dist, so every device on it is in the HTML before any
// script runs, then drops the server build. Each page in PAGES is dist/<slug>.html
// (served with no redirect), all from the same template, with its text as
// dist/<slug>.md, and every page's text, the prompt and the skill in dist/llms-full.txt.
const dist = resolve(import.meta.dir, "../dist");
const server = join(dist, ".server");
const { render }: { render: (index: RegistryIndex, page: Page) => string } = await import(join(server, "entry-server.js"));

const index: RegistryIndex = JSON.parse(await readFile(join(dist, "r/index.json"), "utf8"));
const template = await readFile(join(dist, "index.html"), "utf8");
const data = JSON.stringify(index).replace(/</g, "\\u003c");

/** The template with its head changed for a page: each `[from, to]` must be in it. */
function withHead(html: string, swaps: [string, string][]) {
  return swaps.reduce((page, [from, to]) => {
    if (!page.includes(from)) throw new Error(`dist/index.html has no ${from} to change`);
    return page.split(from).join(to);
  }, html);
}

const [HOME] = PAGES;

/** The head swaps that give a page its own title, address and description. */
function headFor(path: string, title: string, description: string): [string, string][] {
  return [
    [`<title>${HOME.title}</title>`, `<title>${title}</title>`],
    ['href="https://vectoys.com/"', `href="https://vectoys.com${path}"`],
    ['content="https://vectoys.com/"', `content="https://vectoys.com${path}"`],
    [`property="og:title" content="${HOME.title}"`, `property="og:title" content="${title}"`],
    [`name="twitter:title" content="${HOME.title}"`, `name="twitter:title" content="${title}"`],
    [/<meta name="description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta name="description" content="${description}"`],
    [/<meta property="og:description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta property="og:description" content="${description}"`],
    [/<meta name="twitter:description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta name="twitter:description" content="${description}"`],
  ];
}

const texts: { info: (typeof PAGES)[number]; markdown: string }[] = [];
for (const info of PAGES) {
  const { page, slug } = info;
  // The home page keeps the template's own head.
  const head = info === HOME ? [] : headFor(info.path, info.title, info.description(index.items.length));
  const markup = render(index, page);
  // A function, so a "$" in the page or the data is written as it is, not read as a pattern.
  const html = withHead(template, head).replace(
    '<div id="root"></div>',
    () => `<div id="root">${markup}</div><script type="application/json" id="${INDEX_DATA}">${data}</script>`,
  );
  if (!html.includes(`id="${INDEX_DATA}"`)) throw new Error('dist/index.html has no <div id="root"></div> to draw into');
  const file = join(dist, `${slug}.html`);
  await writeFile(file, html);
  const markdown = pageMarkdown(info, markup, index);
  await writeFile(join(dist, `${slug}.md`), markdown);
  texts.push({ info, markdown });
  console.log(`Drew ${page} with ${index.items.length} items into ${file} and its text into ${slug}.md`);
}
const [prompt, skill] = await Promise.all([readFile(join(dist, "prompt.txt"), "utf8"), readFile(join(dist, "skill.md"), "utf8")]);
await writeFile(join(dist, "llms-full.txt"), llmsFullText(index, texts, prompt, skill));
console.log(`Wrote llms-full.txt with ${texts.length} pages`);
await rm(server, { recursive: true, force: true });
