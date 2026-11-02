import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { REPO, type RegistryIndex } from "../src/registry";

/** The site's llms.txt for the registry `index`, in the llmstxt.org format: every item it lists, the skill and the source. */
export function llmsText(index: RegistryIndex): string {
  const site = index.homepage;
  return [
    "# vectoys",
    "",
    "> 3D devices and small toys for landing pages, drawn as plain SVG paths in React. They render on the server, stay sharp at any size and carry live HTML on their screens, with no WebGL, canvas or images. Items copy into a project as source with `npx @vinena/vectoys-cli add <name>`, or with the shadcn CLI from their JSON address.",
    "",
    "To make a new item with a coding agent, run `npx @vinena/vectoys-cli skill` and follow it: `vectoys create`, `vectoys check`, `vectoys preview`, then `vectoys submit`.",
    "",
    "## Docs",
    "",
    `- [Prompt for your agent](${site}/prompt.txt): give it to a coding agent to make 2 or 3 versions of your landing page with vectoys toys`,
    `- [Agent skill](${site}/skill.md): how a coding agent makes, checks, previews and submits a new item`,
    `- [All toys](${site}/toys): every item, live, with its install command and its source`,
    `- [Registry index](${site}/r/index.json): every item, in the shadcn registry format`,
    `- [Source and README](${REPO}): the engine, the React pieces, the CLI and the items`,
    "",
    "## Items",
    "",
    ...index.items.map((item) => `- [${item.title}](${site}/r/${item.name}.json): ${item.description}`),
    "",
  ].join("\n");
}

// Run by the site's dev and build scripts after the registry build: writes
// llms.txt from the registry index, and copies the CLI's SKILL.md to /skill.md.
if (import.meta.main) {
  const root = resolve(import.meta.dir, "../../..");
  const publicDir = resolve(import.meta.dir, "../public");
  const index: RegistryIndex = JSON.parse(await readFile(join(publicDir, "r/index.json"), "utf8"));
  await writeFile(join(publicDir, "llms.txt"), llmsText(index));
  await copyFile(join(root, "packages/cli/SKILL.md"), join(publicDir, "skill.md"));
  console.log(`Wrote llms.txt with ${index.items.length} items and skill.md to ${publicDir}`);
}
