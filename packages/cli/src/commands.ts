import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { CONFIG_FILE, DEFAULT_REGISTRY, defaults, readConfig, writeConfig, type Config } from "./config";
import { fetchJson } from "./fetch";
import { place, type ItemFile } from "./files";
import { importExtension, withExtensions } from "./imports";
import { detect, installCommand, isPackageSpec, missing } from "./pm";
import { confirm } from "./prompt";
import { indexUrl, itemUrl } from "./resolve";

export type Context = {
  cwd: string;
  /** The registry for plain names when `--registry` or VECTOYS_REGISTRY sets one. */
  registry: string | undefined;
  /** Only `--registry` is written to a new vectoys.json; the variable is for one shell. */
  registryFlag: string | undefined;
  yes: boolean;
  overwrite: boolean;
  install: boolean;
  log: (line: string) => void;
};

/** What an item may be named: one folder name, never `.` or `..`. */
export const ITEM_NAME = /^(?!\.{1,2}$)[\w.-]+$/;

type Item = { name: string; title?: string; dependencies?: string[]; files: ItemFile[]; docs?: string };
type Index = { items: { name: string; title?: string; description?: string; license?: string }[] };

export function init(context: Context): Config {
  const found = readConfig(context.cwd);
  if (found) {
    context.log(`${CONFIG_FILE} is already here. Items go to ${found.dir}.`);
    return found;
  }
  const config = defaults(context.cwd, context.registryFlag ?? DEFAULT_REGISTRY);
  writeConfig(context.cwd, config);
  context.log(`Wrote ${CONFIG_FILE}. Items go to ${config.dir}, from ${config.registry}.`);
  context.log(`Packages install with ${detect(context.cwd)}.`);
  return config;
}

export async function add(context: Context, specs: string[]) {
  if (specs.length === 0) throw new Error('Name an item to add, as "vectoys add phone". Run "vectoys list" to see them.');
  const found = readConfig(context.cwd);
  const config = found ?? defaults(context.cwd, context.registryFlag ?? DEFAULT_REGISTRY);
  // Every item is fetched and checked before anything is written, so one bad
  // name leaves the project as it was.
  const items = await Promise.all(
    specs.map(async (spec) => {
      const url = itemUrl(spec, config, context.registry);
      return { url, item: check(await fetchJson<unknown>(url), url) };
    }),
  );
  const root = resolve(context.cwd, config.dir);
  const extension = importExtension(context.cwd);
  const writes = items.flatMap(({ url, item }) => {
    const folder = resolve(root, item.name);
    return withExtensions(place(item.files), extension).map((file) => {
      const path = resolve(folder, file.to);
      if (!folder.startsWith(root + sep) || !path.startsWith(folder + sep)) throw new Error(`${url} has a file that would land outside ${config.dir}.`);
      return { path, content: file.content };
    });
  });

  if (!found) init(context);
  for (const { path, content } of writes) await write(context, path, content);
  for (const { item } of items) if (item.docs) context.log(item.docs);
  installMissing(context, [...new Set(items.flatMap(({ item }) => item.dependencies ?? []))]);
}

export async function list(context: Context, scope: string | undefined) {
  const config = readConfig(context.cwd) ?? defaults(context.cwd);
  // A URL names a registry outright; a scope looks one up in vectoys.json.
  const url = scope && /^https?:\/\//.test(scope) ? indexUrl(undefined, config, scope) : indexUrl(scope, config, scope ? undefined : context.registry);
  const index = await fetchJson<Index>(url);
  if (!Array.isArray(index.items) || index.items.length === 0) {
    context.log(`${url} lists no items.`);
    return;
  }
  const width = Math.max(...index.items.map((item) => item.name.length));
  const prefix = scope?.startsWith("@") ? `${scope}/` : "";
  for (const item of index.items) {
    const license = item.license ? ` (license: ${item.license})` : "";
    context.log(`${(prefix + item.name).padEnd(width + prefix.length)}  ${item.title ?? ""}${license}`);
  }
}

function check(value: unknown, url: string): Item {
  const item = value as Partial<Item>;
  const fine =
    typeof item.name === "string" &&
    ITEM_NAME.test(item.name) &&
    Array.isArray(item.files) &&
    item.files.every((file) => typeof file?.path === "string" && typeof file.content === "string");
  if (!fine) throw new Error(`${url} is not a registry item with a name and files that have content.`);
  if (item.dependencies !== undefined && !(Array.isArray(item.dependencies) && item.dependencies.every(isPackageSpec))) {
    throw new Error(`${url} lists dependencies that are not plain npm package names.`);
  }
  return item as Item;
}

async function write(context: Context, path: string, content: string) {
  const shown = relative(context.cwd, path);
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") === content) {
      context.log(`Same     ${shown}`);
      return;
    }
    const replace = context.overwrite || context.yes || (process.stdin.isTTY && (await confirm(`${shown} is already there. Replace it?`)));
    if (!replace) {
      context.log(`Kept     ${shown} (pass --overwrite to replace it)`);
      return;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  context.log(`Wrote    ${shown}`);
}

function installMissing(context: Context, dependencies: string[]) {
  const needed = missing(context.cwd, dependencies);
  if (needed.length === 0) return;
  const [command, args] = installCommand(detect(context.cwd), needed);
  const line = [command, ...args].join(" ");
  if (!context.install) {
    context.log(`Install what the items need with: ${line}`);
    return;
  }
  context.log(`Running  ${line}`);
  // Windows runs package managers through cmd, which needs the shell; the
  // specs are checked, and quoting keeps characters like ^ as they are.
  const windows = process.platform === "win32";
  const result = spawnSync(command, windows ? args.map((arg) => `"${arg}"`) : args, { cwd: context.cwd, stdio: "inherit", shell: windows });
  if (result.status !== 0) throw new Error(`"${line}" failed. Run it yourself to see why.`);
}
