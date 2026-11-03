import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { llmsText, sitemapXml } from "../scripts/agent-files";
import { PAGES } from "../src/pages";
import type { Entry } from "../src/registry";

const registry = resolve(import.meta.dir, "../../../registry");
const items: Entry[] = readdirSync(registry, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => JSON.parse(readFileSync(join(registry, entry.name, "item.json"), "utf8")));

test("llms.txt links every item in registry/, the prompts, the skill and the index", () => {
  const text = llmsText({ name: "vectoys", homepage: "https://vectoys.com", items });
  expect(text).toStartWith("# vectoys\n\n> ");
  expect(text).toContain("- [Prompt for your agent](https://vectoys.com/prompt.txt): ");
  expect(text).toContain("- [Prompt to submit a toy](https://vectoys.com/submit-prompt.txt): ");
  expect(text).toContain("(https://vectoys.com/skill.md)");
  expect(text).toContain("npx @vinena/vectoys-cli skill");
  expect(text).not.toContain("npx vectoys ");
  expect(text).toContain("(https://vectoys.com/r/index.json)");
  expect(text).toContain("(https://vectoys.com/toys)");
  expect(text).toContain("(https://vectoys.com/submit)");
  expect(text).toContain("(https://github.com/vinenastudio/vectoys)");
  for (const item of items) expect(text).toContain(`- [${item.title}](https://vectoys.com/r/${item.name}.json): ${item.description}`);
});

test("llms.txt links every page, its markdown and the full text", () => {
  const text = llmsText({ name: "vectoys", homepage: "https://vectoys.com", items });
  expect(PAGES.map((info) => info.page)).toEqual(["home", "toys", "submit"]);
  for (const info of PAGES) {
    expect(text).toContain(`- [${info.name}](https://vectoys.com${info.path}): ${info.description(items.length)}`);
    expect(text).toContain(`- [${info.name} in markdown](https://vectoys.com/${info.slug}.md): `);
  }
  expect(text).toContain("- [Home](https://vectoys.com/): ");
  expect(text).toContain("(https://vectoys.com/llms-full.txt)");
});

test("sitemap.xml lists every page", () => {
  expect(sitemapXml("https://vectoys.com")).toBe(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url><loc>https://vectoys.com/</loc></url>",
      "  <url><loc>https://vectoys.com/toys</loc></url>",
      "  <url><loc>https://vectoys.com/submit</loc></url>",
      "</urlset>",
      "",
    ].join("\n"),
  );
});
