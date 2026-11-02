import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { AUTHOR } from "./names";

export { AUTHOR, componentName } from "./names";

export const SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
export const BASE_URL = "https://vectoys.com/r";

/** The items the index lists first, in this order; the rest follow in name order. */
export const FIRST = ["keyboard", "keycap"];

/** What `registry/<name>/item.json` holds. */
export type ItemSource = {
  name: string;
  title: string;
  description: string;
  files: string[];
  dependencies?: string[];
  license: string;
  author?: string;
  credit?: string;
};

/** One item as served at `/r/<name>.json`, in the shadcn registry-item shape. */
export type RegistryItem = {
  $schema: string;
  name: string;
  type: "registry:component";
  title: string;
  description: string;
  author: string;
  /** Package specs, as `@vinena/vectoys-react@^0.3.0` for the repository's own packages. */
  dependencies: string[];
  files: { path: string; type: "registry:component"; target: string; content: string }[];
  meta: { license: string; source: string; credit: string };
};

/** One item as `/r/index.json` lists it, with its maker as "Name (url)" so the gallery can credit them. */
export type IndexEntry = Pick<RegistryItem, "name" | "title" | "description" | "type" | "author"> & { license: string; credit: string };

/** What `/r/index.json` holds. */
export type RegistryIndex = { name: string; homepage: string; items: IndexEntry[] };

type Options = {
  /** The repository root, with the items under `registry/`. */
  root: string;
  /** Where the JSON goes; emptied first so removed items do not linger. */
  out: string;
  /** The URL `out` is served at, written into each file's header. */
  baseUrl?: string;
};

export async function buildRegistry({ root, out, baseUrl = BASE_URL }: Options): Promise<RegistryIndex> {
  const names = (await readdir(join(root, "registry"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(byPlace);
  const versions = await packageVersions(root);
  const items = await Promise.all(names.map((dir) => readItem(root, dir, baseUrl, versions)));

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const item of items) await writeJson(join(out, `${item.name}.json`), item);
  const index: RegistryIndex = {
    name: "vectoys",
    homepage: new URL(baseUrl).origin,
    items: items.map(({ name, title, description, type, author, meta }) => ({ name, title, description, type, author, license: meta.license, credit: meta.credit })),
  };
  await writeJson(join(out, "index.json"), index);
  return index;
}

/** The packages under packages/ that items depend on, by name, each with a caret range from its version; none for a root without them. */
async function packageVersions(root: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  for (const dir of ["engine", "react"]) {
    const path = join(root, "packages", dir, "package.json");
    const pkg: { name?: unknown; version?: unknown } = await readFile(path, "utf8").then(JSON.parse, () => ({}));
    if (typeof pkg.name === "string" && typeof pkg.version === "string") versions.set(pkg.name, `^${pkg.version}`);
  }
  return versions;
}

/** Orders folder names: those in FIRST by their place there, then the rest by name. */
function byPlace(a: string, b: string) {
  const place = (name: string) => (FIRST.includes(name) ? FIRST.indexOf(name) : FIRST.length);
  return place(a) - place(b) || a.localeCompare(b);
}

async function readItem(root: string, dir: string, baseUrl: string, versions: Map<string, string>): Promise<RegistryItem> {
  const file = `registry/${dir}/item.json`;
  const source = checkItem(JSON.parse(await readFile(join(root, file), "utf8")), file);
  // The site finds an item's code by its folder, so the two names must match.
  if (source.name !== dir) throw new Error(`${file} "name" must be "${dir}", the name of its folder`);
  const url = `${baseUrl}/${source.name}.json`;
  const credit = source.credit ?? AUTHOR;
  const files = await Promise.all(
    source.files.map(async (file) => {
      const content = await readFile(join(root, "registry", dir, file), "utf8");
      return {
        path: `registry/${dir}/${file}`,
        type: "registry:component" as const,
        // The shadcn CLI puts each item in its own folder, as `vectoys add` does.
        target: `@components/vectoys/${source.name}/${file.replace(/^src\//, "")}`,
        content: header(file, [`vectoys ${source.name}, from ${url}`, `License: ${source.license}. Credit: ${credit}`]) + content,
      };
    }),
  );
  return {
    $schema: SCHEMA,
    name: source.name,
    type: "registry:component",
    title: source.title,
    description: source.description,
    author: source.author ?? AUTHOR,
    // A range, so an install upgrades a project whose copy is too old for the item's code.
    dependencies: (source.dependencies ?? []).map((name) => (versions.has(name) ? `${name}@${versions.get(name)}` : name)),
    files,
    meta: { license: source.license, source: url, credit },
  };
}

/** An item.json's contents as an ItemSource, or an error naming `file` and the first field it lacks. */
export function checkItem(value: unknown, file: string): ItemSource {
  const item = value as Partial<ItemSource>;
  for (const key of ["name", "title", "description", "license"] as const) {
    if (typeof item[key] !== "string" || item[key] === "") throw new Error(`${file} needs a "${key}"`);
  }
  if (!Array.isArray(item.files) || item.files.length === 0) throw new Error(`${file} needs "files"`);
  if (item.author !== undefined && !isOneLine(item.author)) throw new Error(`${file} "author" must be one line of text like "Name (https://site)"`);
  if (item.credit !== undefined && !isOneLine(item.credit)) throw new Error(`${file} "credit" must be one line of text`);
  return item as ItemSource;
}

/** Text that fits in one line of a file's header comment: not blank, no line breaks, no end of a comment. */
const isOneLine = (value: unknown) => typeof value === "string" && value.trim() !== "" && !/[\r\n\u2028\u2029]/.test(value) && !value.includes("*/");

/** A comment to put on top of a copied file, in the file's own syntax; none for JSON. */
export function header(file: string, lines: string[]): string {
  const ext = extname(file);
  if (ext === ".json") return "";
  if (ext === ".css") return `/*\n${lines.map((line) => ` * ${line}`).join("\n")}\n */\n`;
  return lines.map((line) => `// ${line}\n`).join("");
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
