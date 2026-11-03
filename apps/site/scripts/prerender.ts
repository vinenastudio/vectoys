import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Page } from "../src/app";
import type { RegistryIndex } from "../src/registry";
import { INDEX_DATA } from "../src/registry";

// Draws each page into dist, so every device on it is in the HTML before any
// script runs, then drops the server build. The landing is dist/index.html and
// /toys and /submit are dist/toys.html and dist/submit.html (served with no redirect), all from the same template.
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

const HOME_TITLE = "vectoys: open source SVG 3D engine for device mockups";
const TOYS_TITLE = "All toys: SVG 3D devices and toys for React | vectoys";
const TOYS_DESCRIPTION = `All ${index.items.length} vectoys devices and toys, live in the browser, each with its install command, its source and its shadcn registry address.`;
const SUBMIT_TITLE = "Submit a toy | vectoys";
const SUBMIT_DESCRIPTION = "Make a vectoys toy, check it and send it in with three commands. We review every toy and credit you on the gallery.";

/** The head swaps that give a page its own title, address and description. */
function headFor(path: string, title: string, description: string): [string, string][] {
  return [
    [`<title>${HOME_TITLE}</title>`, `<title>${title}</title>`],
    ['href="https://vectoys.com/"', `href="https://vectoys.com${path}"`],
    ['content="https://vectoys.com/"', `content="https://vectoys.com${path}"`],
    [`property="og:title" content="${HOME_TITLE}"`, `property="og:title" content="${title}"`],
    [`name="twitter:title" content="${HOME_TITLE}"`, `name="twitter:title" content="${title}"`],
    [/<meta name="description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta name="description" content="${description}"`],
    [/<meta property="og:description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta property="og:description" content="${description}"`],
    [/<meta name="twitter:description" content="[^"]*"/.exec(template)?.[0] ?? "", `<meta name="twitter:description" content="${description}"`],
  ];
}

const pages: { page: Page; file: string; head: [string, string][] }[] = [
  { page: "home", file: join(dist, "index.html"), head: [] },
  { page: "toys", file: join(dist, "toys.html"), head: headFor("/toys", TOYS_TITLE, TOYS_DESCRIPTION) },
  { page: "submit", file: join(dist, "submit.html"), head: headFor("/submit", SUBMIT_TITLE, SUBMIT_DESCRIPTION) },
];

for (const { page, file, head } of pages) {
  // A function, so a "$" in the page or the data is written as it is, not read as a pattern.
  const html = withHead(template, head).replace(
    '<div id="root"></div>',
    () => `<div id="root">${render(index, page)}</div><script type="application/json" id="${INDEX_DATA}">${data}</script>`,
  );
  if (!html.includes(`id="${INDEX_DATA}"`)) throw new Error('dist/index.html has no <div id="root"></div> to draw into');
  await writeFile(file, html);
  console.log(`Drew ${page} with ${index.items.length} items into ${file}`);
}
await rm(server, { recursive: true, force: true });
