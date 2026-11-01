import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { llmsText } from "../scripts/agent-files";
import type { Entry } from "../src/registry";

const registry = resolve(import.meta.dir, "../../../registry");
const items: Entry[] = readdirSync(registry, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => JSON.parse(readFileSync(join(registry, entry.name, "item.json"), "utf8")));

test("llms.txt links every item in registry/, the prompt, the skill and the index", () => {
  const text = llmsText({ name: "vectoys", homepage: "https://vectoys.com", items });
  expect(text).toStartWith("# vectoys\n\n> ");
  expect(text).toContain("- [Prompt for your agent](https://vectoys.com/prompt.txt): ");
  expect(text).toContain("(https://vectoys.com/skill.md)");
  expect(text).toContain("npx @vinena/vectoys-cli skill");
  expect(text).not.toContain("npx vectoys ");
  expect(text).toContain("(https://vectoys.com/r/index.json)");
  expect(text).toContain("(https://vectoys.com/toys)");
  expect(text).toContain("(https://github.com/vinenastudio/vectoys)");
  for (const item of items) expect(text).toContain(`- [${item.title}](https://vectoys.com/r/${item.name}.json): ${item.description}`);
});
