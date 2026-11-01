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

/** The packages from `wanted` the project's package.json does not list yet. */
export function missing(cwd: string, wanted: string[]): string[] {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return wanted;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const have = new Set(
    ["dependencies", "devDependencies", "peerDependencies"].flatMap((field) => Object.keys(pkg[field] ?? {})),
  );
  return wanted.filter((spec) => !have.has(packageName(spec)));
}

// "@scope/name@1.2.0" is "@scope/name", "name@^1" is "name".
function packageName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}
