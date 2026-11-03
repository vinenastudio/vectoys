import { expect, mock, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { llmsFullText, pageMarkdown } from "../scripts/agent-files";
import { PAGES } from "../src/pages";
import { addCommand, type Entry, type RegistryIndex } from "../src/registry";

// The gallery's previews come from Vite's import.meta.glob, which bun has not got.
mock.module("../src/sources", () => ({ SOURCES: {} }));
const { render } = await import("../src/entry-server");
const { SUBMIT_PROMPT } = await import("../src/sections/submit");

const registry = resolve(import.meta.dir, "../../../registry");
const items: Entry[] = readdirSync(registry, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => JSON.parse(readFileSync(join(registry, entry.name, "item.json"), "utf8")));
const index: RegistryIndex = { name: "vectoys", homepage: "https://vectoys.com", items };

const pages = PAGES.map((info) => ({ info, markdown: pageMarkdown(info, render(index, info.page), index) }));
const text = (page: string) => pages.find(({ info }) => info.page === page)?.markdown ?? "";

test("every page's text starts with its h1 and carries no demo content, markup or hidden text", () => {
  const h1s = { home: "Draw anything on the web with SVGs", toys: "All toys", submit: "Submit a toy" };
  for (const { info, markdown } of pages) {
    expect(markdown).toStartWith(`# ${h1s[info.page]}\n`);
    for (const junk of ["Buy oat milk", "9:41", "Scrolled", "Show paths", "Copied", "<svg", "<path", "<div", "$ npx"]) expect(markdown).not.toContain(junk);
  }
});

test("the submit page's text has the agent prompt and the link to its full text before the steps by hand", () => {
  const submit = text("submit");
  expect(submit).toContain(`\`\`\`\n${SUBMIT_PROMPT}\n\`\`\``);
  expect(submit).toContain("[Read the full prompt](https://vectoys.com/submit-prompt.txt)");
  expect(submit.indexOf("submit-prompt.txt)")).toBeLessThan(submit.indexOf("## By hand"));
  expect(submit.indexOf(SUBMIT_PROMPT)).toBeLessThan(submit.indexOf("## By hand"));
});

test("the toys page's text has every item's title, description, install command, registry address and source", () => {
  const toys = text("toys");
  for (const item of items) {
    expect(toys).toContain(`## ${item.title}\n`);
    expect(toys).toContain(item.description);
    // A block of code in its list item, indented under the item's heading.
    expect(toys).toContain(`  \`\`\`\n  ${addCommand(item.name)}\n  \`\`\``);
    expect(toys).toContain(`(https://vectoys.com/r/${item.name}.json)`);
    expect(toys).toContain(`(https://github.com/vinenastudio/vectoys/tree/main/registry/${item.name})`);
  }
});

test("llms-full.txt holds every page under its address, then the prompt, the submit prompt and the skill", () => {
  const full = llmsFullText(index, pages, "PROMPT TEXT", "SUBMIT PROMPT TEXT", "---\nname: vectoys\n---\n\nSKILL TEXT");
  expect(full).toStartWith("# vectoys\n\n> ");
  const parts = [
    ...pages.map(({ info, markdown }) => `Source: https://vectoys.com${info.path}\n\n${markdown.trim()}`),
    "Source: https://vectoys.com/prompt.txt\n\nPROMPT TEXT",
    "Source: https://vectoys.com/submit-prompt.txt\n\nSUBMIT PROMPT TEXT",
    "Source: https://vectoys.com/skill.md\n\nSKILL TEXT",
  ];
  let from = 0;
  for (const part of parts) {
    const at = full.indexOf(part, from);
    expect(at).toBeGreaterThanOrEqual(from);
    from = at + part.length;
  }
  expect(full).not.toContain("name: vectoys");
});
