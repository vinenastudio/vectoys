import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

const LOCKFILES: [string, PackageManager][] = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

// A package name with an optional version or tag, and nothing a package
// manager or a shell could read as an option or a command.
const SPEC = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[\w.^~*+-]+)?$/i;

/** Whether a registry's dependency is a plain npm package spec. */
export function isPackageSpec(value: unknown): value is string {
  return typeof value === "string" && SPEC.test(value);
}

/**
 * The package manager of the project or the workspace it is in: the first
 * folder up from `cwd` with a lockfile, a pnpm-workspace.yaml, or a
 * package.json that names a packageManager or workspaces. Its packageManager
 * field wins over its lockfile. The search stops at the repository root, the
 * first folder with a .git. npm if no folder has one.
 */
export function detect(cwd: string): PackageManager {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const pkg = readPackage(join(dir, "package.json"));
    const named = typeof pkg?.packageManager === "string" ? pkg.packageManager.split("@")[0] : undefined;
    if (named === "bun" || named === "pnpm" || named === "yarn" || named === "npm") return named;
    const locked = LOCKFILES.find(([file]) => existsSync(join(dir, file)))?.[1];
    if (locked) return locked;
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return "pnpm";
    if (pkg?.packageManager || pkg?.workspaces || existsSync(join(dir, ".git")) || dirname(dir) === dir) return "npm";
  }
}

function readPackage(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function installCommand(pm: PackageManager, packages: string[]): [string, string[]] {
  return [pm, [pm === "npm" ? "install" : "add", ...packages]];
}

/**
 * The specs from `wanted` the project needs installed: a package its
 * package.json does not list yet, or one whose version falls outside the
 * spec's range. The version is the installed one in node_modules, else the
 * lowest the package.json range allows.
 */
export function missing(cwd: string, wanted: string[]): string[] {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return wanted;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const listed: Record<string, unknown> = Object.assign({}, ...["peerDependencies", "devDependencies", "dependencies"].map((field) => pkg[field] ?? {}));
  return wanted.filter((spec) => {
    const name = packageName(spec);
    if (!(name in listed)) return true;
    const installed = readPackage(join(cwd, "node_modules", name, "package.json"))?.version;
    const have = typeof installed === "string" ? installed : typeof listed[name] === "string" ? listed[name].replace(/^[\^~=v\s]+/, "") : "";
    return !satisfies(have, spec.slice(name.length + 1));
  });
}

const parse = (version: string) => {
  const found = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return found ? [Number(found[1]), Number(found[2]), Number(found[3])] : undefined;
};

// Below 0 if `a` is the lower version, above 0 if it is the higher.
const compare = (a: number[], b: number[]) => a.map((part, at) => part - b[at]!).find((difference) => difference !== 0) ?? 0;

/**
 * Whether `version` meets `range`: an exact version, or a caret range as npm
 * reads it, where ^0.3.0 is at least 0.3.0 and under 0.4.0. Any other range,
 * or a version that is not X.Y.Z, such as workspace:*, counts as met.
 */
export function satisfies(version: string, range: string): boolean {
  const have = parse(version);
  if (!have || !/^\^?\d+\.\d+\.\d+$/.test(range)) return true;
  const want = parse(range.replace("^", ""))!;
  if (!range.startsWith("^")) return compare(have, want) === 0;
  // The first part that is not 0 stays; the next one up is too far.
  const fixed = Math.max(0, want.findIndex((part) => part !== 0));
  const below = want.map((part, at) => (at < fixed ? part : at === fixed ? part + 1 : 0));
  return compare(have, want) >= 0 && compare(have, below) < 0;
}

// "@scope/name@1.2.0" is "@scope/name", "name@^1" is "name".
function packageName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}
