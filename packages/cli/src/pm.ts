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
 * package.json does not list yet, or one older than the spec's version. The
 * version is the installed one in node_modules, else the lowest the
 * package.json range allows. A newer version is kept, never replaced.
 */
export function missing(cwd: string, wanted: string[]): string[] {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return wanted;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const listed: Record<string, unknown> = Object.assign({}, ...["peerDependencies", "devDependencies", "dependencies"].map((field) => pkg[field] ?? {}));
  return wanted.filter((spec) => {
    const name = packageName(spec);
    if (!Object.hasOwn(listed, name)) return true;
    const installed = readPackage(join(cwd, "node_modules", name, "package.json"))?.version;
    const range = listed[name];
    const have = typeof installed === "string" ? installed : typeof range === "string" ? range.replace(/^[\^~=v\s]+/, "") : "";
    return !atLeast(have, spec.slice(name.length + 1));
  });
}

type Version = { parts: number[]; pre: string[] };

const parse = (version: string): Version | undefined => {
  const found = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]*)?$/.exec(version);
  return found ? { parts: [Number(found[1]), Number(found[2]), Number(found[3])], pre: found[4]?.split(".") ?? [] } : undefined;
};

// Below 0 if `a` is the lower version, above 0 if it is the higher, by semver
// order: a prerelease such as 0.4.0-next.1 is below 0.4.0.
function compare(a: Version, b: Version): number {
  for (const [at, part] of a.parts.entries()) {
    const other = b.parts[at];
    if (other === undefined) return 1;
    if (part !== other) return part - other;
  }
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  for (const [at, id] of a.pre.entries()) {
    const other = b.pre[at];
    if (other === undefined) return 1;
    if (id === other) continue;
    const [x, y] = [/^\d+$/.test(id), /^\d+$/.test(other)];
    if (x && y) return Number(id) - Number(other);
    if (x !== y) return x ? -1 : 1;
    return id < other ? -1 : 1;
  }
  return a.pre.length - b.pre.length;
}

/**
 * Whether `version` is at least the base version of `range`, an exact version
 * or a caret range such as ^0.3.0 or ^0.4.0-next.1. Any other range, or a
 * version that is not semver, such as workspace:*, counts as met.
 */
export function atLeast(version: string, range: string): boolean {
  const have = parse(version);
  const want = parse(range.replace(/^\^/, ""));
  if (!have || !want) return true;
  return compare(have, want) >= 0;
}

// "@scope/name@1.2.0" is "@scope/name", "name@^1" is "name".
function packageName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}
