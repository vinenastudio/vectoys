import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, posix, relative, resolve, sep } from "node:path";
import { checkItem, type ItemSource } from "@vectoys/registry-build";
import { ITEM_NAME, type Context } from "./commands";
import { BASE_TSCONFIG, componentName } from "./create";
import { isPackageSpec } from "./pm";

/**
 * Brand and product names an item may not use: items are generic, never a
 * maker's product. Words that are also plain English, such as surface or
 * windows, count only as part of a product's name.
 */
export const BRANDS = [
  "apple watch",
  "galaxy tab",
  "pixel phone",
  "surface pro",
  "iphone",
  "ipad",
  "macbook",
  "imac",
  "airpods",
  "apple",
  "google",
  "microsoft",
  "samsung",
  "playstation",
  "xbox",
  "nintendo",
];
const BRAND = new RegExp(`\\b(${BRANDS.map((brand) => brand.replace(" ", "\\s+")).join("|")})\\b`, "gi");

/** The most an item's files may weigh together, in bytes: room for a device with a full 3D model and a hand-drawn front. */
export const MAX_SOURCE = 96 * 1024;

export type Result = { pass: boolean; line: string };

/** The brand names in `text`, lower case, each once. */
export function brands(text: string): string[] {
  return [...new Set([...text.matchAll(BRAND)].map((match) => match[0].toLowerCase().replace(/\s+/g, " ")))];
}

// Run by bun, which loads TSX as it is. React comes from the item's own
// folder, so the component and the renderer share one copy. The script finds
// the component `entry` exports, `wanted` if it can, and runs `body` with it.
const MARK = "@@vectoys-check@@";
export function bunScript(body: string): string {
  return `
const [entry, dir, wanted] = process.argv.slice(2);
const done = (value) => process.stdout.write("\\n${MARK}" + JSON.stringify(value));
try {
  const { createElement } = await import(Bun.resolveSync("react", dir));
  const { renderToStaticMarkup } = await import(Bun.resolveSync("react-dom/server", dir));
  const mod = await import(entry);
  const isComponent = (value) => typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);
  const name = isComponent(mod[wanted]) ? wanted : Object.keys(mod).find((key) => /^[A-Z]/.test(key) && isComponent(mod[key]));
  if (!name) throw new Error("it exports no component");
  ${body}
} catch (error) {
  done({ error: error instanceof Error ? error.message : String(error) });
}
`;
}

const RUNNER = bunScript(`const render = () => renderToStaticMarkup(createElement(mod[name]));
  done({ name, html: [render(), render()] });`);

type Rendered = { name: string; html: [string, string] } | { error: string };

function isRendered(value: unknown): value is Rendered {
  if (typeof value !== "object" || value === null) return false;
  if ("error" in value) return typeof value.error === "string";
  return (
    "name" in value &&
    typeof value.name === "string" &&
    "html" in value &&
    Array.isArray(value.html) &&
    value.html.length === 2 &&
    value.html.every((html) => typeof html === "string")
  );
}

/** Runs a `bunScript` in bun on the component `entry` exports; what the script hands back, or why it could not run. */
export function runInBun(script: string, entry: string, dir: string, wanted: string): { value: unknown } | { error: string } {
  const work = mkdtempSync(join(tmpdir(), "vectoys-check-"));
  try {
    // Bun runs in the empty work folder, so it never reads a bunfig.toml the item brings.
    const runner = join(work, "render.mjs");
    writeFileSync(runner, script);
    const result = spawnSync("bun", [runner, entry, dir, wanted], { cwd: work, encoding: "utf8", timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
    if (result.error) {
      const missing = "code" in result.error && result.error.code === "ENOENT";
      return { error: missing ? "it needs bun to load the item's TSX: https://bun.sh" : result.error.message };
    }
    const at = result.stdout.lastIndexOf(MARK);
    if (at === -1) return { error: result.stderr.trim() || "bun stopped without rendering it" };
    const value: unknown = JSON.parse(result.stdout.slice(at + MARK.length));
    if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") return { error: value.error };
    return { value };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Renders the component `entry` exports, twice, with no props, in bun. */
function render(entry: string, dir: string, wanted: string): Rendered {
  const ran = runInBun(RUNNER, entry, dir, wanted);
  if ("error" in ran) return ran;
  return isRendered(ran.value) ? ran.value : { error: "bun gave back something other than markup" };
}

/** The text a page shows or reads out: the markup's text and its labels, without styles. */
function textOf(html: string): string {
  const labels = [...html.matchAll(/\s(?:aria-label|title|alt)="([^"]*)"/g)].map((match) => match[1]);
  const text = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
  return [text, ...labels].join(" ");
}

const labelled = (attributes: string) => /\saria-label="[^"]*\S[^"]*"/.test(attributes) || /\saria-labelledby="[^"]+"/.test(attributes);

/** How the markup is named for assistive technology, or undefined if it is not. */
export function accessibleName(html: string): string | undefined {
  const root = /^<[a-z][\w-]*([^>]*)>/i.exec(html);
  const role = /\srole="(img|group)"/.exec(root?.[1] ?? "")?.[1];
  if (role && labelled(root?.[1] ?? "")) return `the root is role="${role}" with an aria-label`;
  const controls = [...html.matchAll(/<(button|a|input|select|textarea)\b([^>]*)>/gi)].filter(([, tag, attributes]) => tag?.toLowerCase() !== "a" || /\shref=/.test(attributes ?? ""));
  if (controls.length === 0) return undefined;
  const named = controls.every((control) => {
    const [, tag = "", attributes = ""] = control;
    if (labelled(attributes)) return true;
    const kind = tag.toLowerCase();
    if (kind !== "button" && kind !== "a") return false;
    const after = html.slice((control.index ?? 0) + control[0].length);
    const end = after.search(new RegExp(`</${kind}>`, "i"));
    return after.slice(0, end === -1 ? 0 : end).replace(/<[^>]*>/g, "").trim() !== "";
  });
  return named ? `its ${controls.length} control${controls.length === 1 ? " is" : "s are"} labelled` : undefined;
}

/** What is wrong with an item.json's contents beyond what the registry build checks, if anything. */
function itemProblem(item: ItemSource, dir: string): string | undefined {
  if (!ITEM_NAME.test(item.name)) return `"${item.name}" is not an item name`;
  const file = item.files.find((path) => typeof path !== "string" || !resolve(dir, path).startsWith(dir + sep) || !existsSync(resolve(dir, path)));
  if (file !== undefined) return `files lists ${JSON.stringify(file)}, which is not a file in the folder`;
  const other = item.files.find((path) => !lstatSync(resolve(dir, path)).isFile());
  if (other !== undefined) {
    const stat = lstatSync(resolve(dir, other));
    const kind = stat.isSymbolicLink() ? "a symlink, " : stat.isDirectory() ? "a folder, " : "";
    return `files lists ${JSON.stringify(other)}, which is ${kind}not a regular file`;
  }
  if (item.dependencies !== undefined && !(Array.isArray(item.dependencies) && item.dependencies.every(isPackageSpec))) {
    return "dependencies are not all plain npm package names";
  }
  return undefined;
}

/** The only packages an item may list in item.json's dependencies. */
export const ALLOWED_DEPENDENCIES = ["@vinena/vectoys", "@vinena/vectoys-react"];

/** The packages an item's files may import, with their subpaths, besides each other. */
export const ALLOWED_IMPORTS = [...ALLOWED_DEPENDENCIES, "react"];

/** One of an item's files, as bun reads it: its code without comments, types or JSX, and what it imports. */
export type Source = { path: string; code: string; imports: { path: string; kind: string }[] } | { path: string; error: string };

// Run by bun: reads each file the item lists and hands back its code as plain
// JavaScript, with comments gone and JSX turned into calls, and its imports.
// Bun's transpiler only parses, so nothing in the files runs.
const SCANNER = `
const [, dir, list] = process.argv.slice(2);
const { join } = await import("node:path");
const code = (path) => /\\.[cm]?[jt]sx?$/.test(path);
const sources = [];
for (const path of JSON.parse(list)) {
  const text = await Bun.file(join(dir, path)).text();
  if (!code(path)) { sources.push({ path, code: text, imports: [] }); continue; }
  try {
    const transpiler = new Bun.Transpiler({ loader: path.endsWith("x") ? "tsx" : "ts", deadCodeElimination: false });
    sources.push({ path, code: transpiler.transformSync(text), imports: transpiler.scan(text).imports });
  } catch (error) {
    sources.push({ path, error: error instanceof Error ? error.message : String(error) });
  }
}
process.stdout.write("\\n${MARK}" + JSON.stringify(sources));
`;

function isSource(value: unknown): value is Source {
  if (typeof value !== "object" || value === null || !("path" in value) || typeof value.path !== "string") return false;
  if ("error" in value) return typeof value.error === "string";
  return (
    "code" in value &&
    typeof value.code === "string" &&
    "imports" in value &&
    Array.isArray(value.imports) &&
    value.imports.every((entry: unknown) => typeof entry === "object" && entry !== null && "path" in entry && typeof entry.path === "string" && "kind" in entry && typeof entry.kind === "string")
  );
}

/** Reads `files` in the folder `dir` with bun, without running them; the sources, or why bun could not read them. */
export function sources(dir: string, files: string[]): Source[] | string {
  const ran = runInBun(SCANNER, dir, dir, JSON.stringify(files));
  if ("error" in ran) return ran.error;
  return Array.isArray(ran.value) && ran.value.every(isSource) ? ran.value : "bun gave back something other than the files";
}

const STRING = "[\"'`]";
const GLOBALS = ["fetch", "eval", "Function", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "importScripts", "localStorage", "sessionStorage", "indexedDB", "cookie", "constructor"];

/** What an item's code may not do, each with the words a failing line uses for it. */
const UNSAFE: [RegExp, string][] = [
  [/<script\b/i, "has a <script> tag"],
  [new RegExp(`${STRING}script${STRING}`, "i"), "makes a script element"],
  [/\b(dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML)\b/, "sets HTML from a string"],
  [/\bdocument\s*\.\s*write/, "writes into the document"],
  [/\beval\s*\(/, "calls eval"],
  [/\bFunction\s*\(|\.\s*constructor\b/, "makes a function from a string"],
  [new RegExp(`\\bset(Timeout|Interval)\\s*\\(\\s*${STRING}`), "passes a string to setTimeout or setInterval"],
  [/\bfetch\s*\(/, "calls fetch"],
  [/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/, "makes a network call"],
  [/\bimport\s*\(/, "has a dynamic import"],
  [/\brequire\s*\(/, "calls require"],
  [/\b(localStorage|sessionStorage|indexedDB)\b|\bdocument\s*\.\s*cookie\b/, "uses browser storage or cookies"],
  [new RegExp(`${STRING}(${GLOBALS.join("|")})${STRING}`), "names a blocked browser feature in a string"],
  [new RegExp(`${STRING}\\s*(?!https?://www\\.w3\\.org/)(https?:|//|javascript:|data:\\s*text/html)`, "i"), "has an outside URL"],
  [/url\(\s*["']?\s*(https?:|\/\/)|@import\b/i, "loads a style from outside"],
];

/** What rendered markup may not have, each with the words a failing line uses for it. */
const UNSAFE_MARKUP: [RegExp, string][] = [
  [/<script\b/i, "has a <script> tag"],
  [/\s(href|xlink:href|src|srcset|action|formaction)="\s*(https?:|\/\/|javascript:|data:\s*text\/html)/i, "links outside"],
  [/url\(\s*(&quot;|&#x27;|["'])?\s*(https?:|\/\/)/i, "loads a style from outside"],
];

const allowed = (name: string) => ALLOWED_IMPORTS.some((pkg) => name === pkg || name.startsWith(`${pkg}/`));

/** Whether the relative import `specifier` in `from` names another of the item's `files`. */
function listed(specifier: string, from: string, files: string[]): boolean {
  const base = posix.join(posix.dirname(from), specifier).replace(/\.js$/, "");
  return ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].some((suffix) => files.includes(base + suffix));
}

/**
 * What in an item's files could run code it does not show or reach outside
 * the page: scripts, eval, network calls, browser storage, outside URLs, and
 * imports of anything but its own files and the allowed packages. One line
 * for each, naming the file; none if the code is safe.
 */
export function safety(files: Source[], item: Pick<ItemSource, "dependencies">): string[] {
  const problems = (item.dependencies ?? []).filter((name) => !ALLOWED_DEPENDENCIES.includes(name)).map((name) => `item.json depends on ${name}, which is not ${ALLOWED_DEPENDENCIES.join(" or ")}`);
  const paths = files.map((file) => file.path);
  for (const file of files) {
    if ("error" in file) {
      problems.push(`${file.path} does not parse: ${file.error}`);
      continue;
    }
    for (const entry of file.imports) {
      if (entry.kind !== "import-statement") continue;
      if (entry.path.startsWith(".") ? !listed(entry.path, file.path, paths) : !allowed(entry.path)) problems.push(`${file.path} imports ${entry.path}, which is not one of its files or ${ALLOWED_IMPORTS.join(", ")}`);
    }
    for (const [pattern, what] of UNSAFE) {
      const found = pattern.exec(file.code);
      if (found) problems.push(`${file.path} ${what}: ${found[0].trim()}`);
    }
  }
  return problems;
}

/** What in rendered markup could run a script or load something from outside; none if it is safe. */
export function markupSafety(html: string): string[] {
  return UNSAFE_MARKUP.flatMap(([pattern, what]) => {
    const found = pattern.exec(html);
    return found ? [`the markup ${what}: ${found[0].trim()}`] : [];
  });
}

/** The files and folders in `dir` that could set up bun or a package manager: bunfig.toml and any name starting with a dot but .gitignore. */
export function configFiles(dir: string, under = ""): string[] {
  return readdirSync(join(dir, under), { withFileTypes: true }).flatMap((entry) => {
    const path = under ? `${under}/${entry.name}` : entry.name;
    if (entry.name === "bunfig.toml" || (entry.name.startsWith(".") && entry.name !== ".gitignore")) return [path];
    return entry.isDirectory() && entry.name !== "node_modules" ? configFiles(dir, path) : [];
  });
}

const TSCONFIG = /^[tj]sconfig.*\.json$/;

/** The tsconfig and jsconfig files in `dir`, outside node_modules, as paths from `dir`. */
function tsconfigFiles(dir: string, under = ""): string[] {
  return readdirSync(join(dir, under), { withFileTypes: true }).flatMap((entry) => {
    const path = under ? `${under}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : tsconfigFiles(dir, path);
    return TSCONFIG.test(entry.name) ? [path] : [];
  });
}

/**
 * What in the item's tsconfig and jsconfig files could make an import load
 * some other file: compilerOptions paths, baseUrl or rootDirs, or extending
 * any config but the repository's shared base from the folder's own
 * tsconfig.json. One line for each.
 */
export function tsconfigProblems(dir: string): string[] {
  return tsconfigFiles(dir).flatMap((file) => {
    let config: unknown;
    try {
      config = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      return [`${file} is not plain JSON, so check cannot tell what it sets`];
    }
    if (typeof config !== "object" || config === null || Array.isArray(config)) return [`${file} is not an object`];
    const problems: string[] = [];
    // The base is only the shared one from the folder's own tsconfig.json; from a subfolder the same path names another file.
    if ("extends" in config && (file !== "tsconfig.json" || config.extends !== BASE_TSCONFIG)) problems.push(`${file} extends ${JSON.stringify(config.extends)}, which is not ${BASE_TSCONFIG} from the folder's tsconfig.json`);
    const options = "compilerOptions" in config && typeof config.compilerOptions === "object" && config.compilerOptions !== null ? config.compilerOptions : {};
    for (const option of ["paths", "baseUrl", "rootDirs"]) if (option in options) problems.push(`${file} sets compilerOptions.${option}, which moves imports`);
    return problems;
  });
}

/** Reads and checks item.json; the item, or the reason it fails. */
export function readItem(dir: string): ItemSource | string {
  const path = join(dir, "item.json");
  if (!existsSync(path)) return "there is no item.json";
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return `item.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "item.json is not an object";
  try {
    const item = checkItem(value, "item.json");
    return itemProblem(item, dir) ?? item;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The .tsx file an item's component is in: the one named after the item, else the first. */
export function componentFile(item: ItemSource): string | undefined {
  return item.files.find((file) => basename(file, ".tsx") === item.name && extname(file) === ".tsx") ?? item.files.find((file) => extname(file) === ".tsx");
}

/** Every check on the item folder `dir`, in order; stops after item.json if it fails. */
export function checks(dir: string): Result[] {
  const item = readItem(dir);
  if (typeof item === "string") return [{ pass: false, line: item }];
  const results: Result[] = [{ pass: true, line: "item.json has what the registry needs" }];

  const config = [...configFiles(dir).map((file) => `the folder has ${file}, which items may not have`), ...tsconfigProblems(dir)];
  if (config.length) return [...results, ...config.map((line) => ({ pass: false, line }))];

  const size = item.files.reduce((sum, file) => sum + lstatSync(resolve(dir, file)).size, 0);
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  results.push({ pass: size < MAX_SOURCE, line: `the files are ${kb(size)}, ${size < MAX_SOURCE ? "under" : "over"} ${kb(MAX_SOURCE)}` });

  const named = brands([item.name, item.title, item.description].join(" "));
  results.push({ pass: named.length === 0, line: named.length ? `item.json names brands: ${named.join(", ")}` : "item.json names no brands" });

  // Before anything renders, so code that fails runs nowhere.
  const read = sources(dir, item.files);
  const unsafe = typeof read === "string" ? [`bun could not read the files: ${read}`] : safety(read, item);
  if (unsafe.length) return [...results, ...unsafe.map((line) => ({ pass: false, line }))];
  results.push({ pass: true, line: "the code is safe: no scripts, eval, network calls or outside imports" });

  const component = componentFile(item);
  if (!component) return [...results, { pass: false, line: "files lists no .tsx component to render" }];
  const rendered = render(resolve(dir, component), dir, componentName(item.name));
  if ("error" in rendered) return [...results, { pass: false, line: `${component} does not render on the server: ${rendered.error}` }];
  const [html, again] = rendered.html;
  results.push({ pass: true, line: `${rendered.name} renders on the server` });

  const broken = ["NaN", "Infinity"].filter((word) => html.includes(word));
  results.push({ pass: broken.length === 0, line: broken.length ? `the markup has ${broken.join(" and ")} in it` : "the markup has no NaN or Infinity" });
  results.push({ pass: html === again, line: html === again ? "two renders give the same markup" : "two renders give different markup" });

  const outside = markupSafety(html);
  if (outside.length) results.push(...outside.map((line) => ({ pass: false, line })));
  else results.push({ pass: true, line: "the markup has no scripts or outside links" });

  const shown = brands(textOf(html));
  results.push({ pass: shown.length === 0, line: shown.length ? `the rendered text names brands: ${shown.join(", ")}` : "the rendered text names no brands" });

  const name = accessibleName(html);
  results.push({ pass: name !== undefined, line: name ?? 'the root is not role="img" or "group" with an aria-label, and it has no labelled controls' });
  return results;
}

/** Checks an item folder and prints each result; fails if any check does. */
export function check(context: Context, given: string | undefined) {
  const dir = resolve(context.cwd, given ?? ".");
  context.log(`Checking ${relative(context.cwd, dir) || "."}`);
  const results = checks(dir);
  for (const result of results) context.log(`  ${result.pass ? "pass" : "FAIL"}  ${result.line}`);
  const failed = results.filter((result) => !result.pass).length;
  if (failed > 0) throw new Error(`${failed} of ${results.length} checks fail.`);
  context.log(`All ${results.length} checks pass.`);
}
