import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PAGES } from "../src/pages";
import { REPO, addCommand, type RegistryIndex } from "../src/registry";
import { htmlToMarkdown } from "./html-to-markdown";

const SUMMARY =
  "> 3D devices and small toys for landing pages, drawn as plain SVG paths in React. They render on the server, stay sharp at any size and carry live HTML on their screens, with no WebGL, canvas or images. Items copy into a project as source with `npx @vinena/vectoys-cli add <name>`, or with the shadcn CLI from their JSON address.";

type PageInfo = (typeof PAGES)[number];

const pageUrl = (site: string, info: PageInfo) => `${site}${info.path}`;
const markdownUrl = (site: string, info: PageInfo) => `${site}/${info.slug}.md`;

/** The site's llms.txt for the registry `index`, in the llmstxt.org format: every page, every item it lists, the skill and the source. */
export function llmsText(index: RegistryIndex): string {
  const site = index.homepage;
  return [
    "# vectoys",
    "",
    SUMMARY,
    "",
    "To make a new item with a coding agent, run `npx @vinena/vectoys-cli skill` and follow it: `vectoys create`, `vectoys check`, `vectoys preview`, then `vectoys submit`.",
    "",
    "## Pages",
    "",
    ...PAGES.flatMap((info) => [
      `- [${info.name}](${pageUrl(site, info)}): ${info.description(index.items.length)}`,
      `- [${info.name} in markdown](${markdownUrl(site, info)}): the text of ${pageUrl(site, info)} as markdown`,
    ]),
    `- [Full text](${site}/llms-full.txt): every page, the prompts and the skill in one markdown file`,
    "",
    "## Docs",
    "",
    `- [Prompt for your agent](${site}/prompt.txt): give it to a coding agent to make 2 or 3 versions of your landing page with vectoys toys`,
    `- [Prompt to submit a toy](${site}/submit-prompt.txt): give it to a coding agent to make, check, preview and submit a new toy`,
    `- [Agent skill](${site}/skill.md): how a coding agent makes, checks, previews and submits a new item`,
    `- [Registry index](${site}/r/index.json): every item, in the shadcn registry format`,
    `- [Source and README](${REPO}): the engine, the React pieces, the CLI and the items`,
    "",
    "## Items",
    "",
    ...index.items.map((item) => `- [${item.title}](${site}/r/${item.name}.json): ${item.description}`),
    "",
  ].join("\n");
}

/** A page's text as markdown, from the HTML the page renders: its <main>, and on /toys every item's registry address. */
export function pageMarkdown(info: PageInfo, html: string, index: RegistryIndex): string {
  const site = index.homepage;
  const text = htmlToMarkdown(html, { base: site, within: "main" });
  if (info.page !== "toys") return text;
  return [
    text,
    "## Registry addresses",
    "",
    "Each item is also a JSON file in the shadcn registry format, so the shadcn CLI installs it from its address.",
    "",
    ...index.items.map((item) => `- [${item.title}](${site}/r/${item.name}.json): \`${addCommand(item.name)}\` or \`npx shadcn add ${site}/r/${item.name}.json\``),
    "",
  ].join("\n");
}

/** llms-full.txt: every page's markdown, then the prompt, the submit prompt and the skill, each under the address it came from. */
export function llmsFullText(index: RegistryIndex, pages: { info: PageInfo; markdown: string }[], prompt: string, submitPrompt: string, skill: string): string {
  const site = index.homepage;
  const part = (url: string, text: string) => `---\n\nSource: ${url}\n\n${text.trim()}\n`;
  return [
    `# vectoys\n\n${SUMMARY}\n\nThe full text of every page on ${site}, then the prompt for your agent, the prompt to submit a toy and the agent skill. The short index is ${site}/llms.txt.\n`,
    ...pages.map(({ info, markdown }) => part(pageUrl(site, info), markdown)),
    part(`${site}/prompt.txt`, prompt),
    part(`${site}/submit-prompt.txt`, submitPrompt),
    part(`${site}/skill.md`, skill.replace(/^---\n[\s\S]*?\n---\n+/, "")),
  ].join("\n");
}

/** sitemap.xml: every page. */
export function sitemapXml(site: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((info) => `  <url><loc>${pageUrl(site, info)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

// Run by the site's dev and build scripts after the registry build: writes
// llms.txt and sitemap.xml from the registry index and the page list, and
// copies the CLI's SKILL.md to /skill.md. The prerender writes llms-full.txt.
if (import.meta.main) {
  const root = resolve(import.meta.dir, "../../..");
  const publicDir = resolve(import.meta.dir, "../public");
  const index: RegistryIndex = JSON.parse(await readFile(join(publicDir, "r/index.json"), "utf8"));
  await writeFile(join(publicDir, "llms.txt"), llmsText(index));
  await writeFile(join(publicDir, "sitemap.xml"), sitemapXml(index.homepage));
  await copyFile(join(root, "packages/cli/SKILL.md"), join(publicDir, "skill.md"));
  console.log(`Wrote llms.txt with ${index.items.length} items, sitemap.xml and skill.md to ${publicDir}`);
}
