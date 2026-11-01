import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import type { Placed } from "./files";

/** What relative imports end with in the project: `.js`, the file's own `.ts`/`.tsx`, or nothing. */
export type ImportExtension = "js" | "ts" | undefined;

const NODE = new Set(["node16", "node18", "node20", "nodenext"]);

/**
 * Whether the nearest tsconfig.json up from `cwd` resolves modules the way
 * Node does (node16 or nodenext), where relative imports need an extension.
 * With allowImportingTsExtensions they may name the .ts file; otherwise they
 * name the .js file TypeScript emits.
 */
export function importExtension(cwd: string): ImportExtension {
  const path = nearest(cwd, "tsconfig.json");
  if (!path) return undefined;
  const options = compilerOptions(path, new Set());
  const resolution = lower(options.moduleResolution) ?? (NODE.has(lower(options.module) ?? "") ? "nodenext" : undefined);
  if (!resolution || !NODE.has(resolution)) return undefined;
  return options.allowImportingTsExtensions === true ? "ts" : "js";
}

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.\.?\/[^"'\n]*)\2/g;
const SOURCE = /\.tsx?$/;

/**
 * The files with each relative import or export of another of them given the
 * extension, so they still resolve under node16 or nodenext. Specifiers that
 * already name a file, or that name none of these files, stay as they are.
 */
export function withExtensions(files: Placed[], extension: ImportExtension): Placed[] {
  if (!extension) return files;
  const paths = new Set(files.map((file) => file.to));
  return files.map((file) => {
    if (!SOURCE.test(file.to)) return file;
    const content = file.content.replace(SPECIFIER, (match, before: string, quote: string, specifier: string) => {
      const base = posix.join(posix.dirname(file.to), specifier).replace(/\/$/, "");
      if (paths.has(base)) return match;
      const suffix = ["", "/index"].flatMap((index) => [`${index}.ts`, `${index}.tsx`]).find((candidate) => paths.has(base + candidate));
      if (!suffix) return match;
      const named = extension === "ts" ? suffix : suffix.replace(SOURCE, ".js");
      return `${before}${quote}${specifier.replace(/\/$/, "")}${named}${quote}`;
    });
    return { ...file, content };
  });
}

function nearest(from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, name))) return join(dir, name);
    if (dirname(dir) === dir) return undefined;
  }
}

type Options = Record<string, unknown>;

// The file's compilerOptions over those of the configs it extends by a
// relative path. Configs extended from packages are not followed.
function compilerOptions(path: string, seen: Set<string>): Options {
  if (seen.has(path) || !existsSync(path)) return {};
  seen.add(path);
  let config: { extends?: unknown; compilerOptions?: Options };
  try {
    config = JSON.parse(jsonc(readFileSync(path, "utf8")));
  } catch {
    return {};
  }
  const parents = (Array.isArray(config.extends) ? config.extends : [config.extends]).filter(
    (parent): parent is string => typeof parent === "string" && /^\.\.?\//.test(parent),
  );
  const inherited = parents.reduce<Options>((options, parent) => {
    const file = resolve(dirname(path), parent);
    return { ...options, ...compilerOptions(existsSync(file) || file.endsWith(".json") ? file : `${file}.json`, seen) };
  }, {});
  return { ...inherited, ...config.compilerOptions };
}

// tsconfig.json as plain JSON: comments and trailing commas dropped.
function jsonc(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(i, end + 1);
      i = end;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if (char === "}" || char === "]") {
      out = out.replace(/,\s*$/, "") + char;
    } else {
      out += char;
    }
  }
  return out;
}

function lower(value: unknown): string | undefined {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}
