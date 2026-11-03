import { existsSync } from "node:fs";
import { join } from "node:path";

// The names `registry/` may hold, so a name is safe in a path, a check and a comment.
export const ITEM_NAME = /^[a-z0-9][a-z0-9-]*$/;

// One folder of snapshots for each project in playwright.config.ts.
export const PROJECTS = ["light", "dark", "reduced-motion"] as const;

const SNAPSHOTS = join(import.meta.dirname, "snapshots");

function valid(name: string) {
  if (!ITEM_NAME.test(name)) throw new Error(`Not an item name: ${JSON.stringify(name)}`);
  return name;
}

/** The items in `head` that `base` does not have, from `git ls-tree --name-only <ref> registry/` lines. */
export function newItems(base: readonly string[], head: readonly string[]): string[] {
  const names = (lines: readonly string[]) => lines.filter(Boolean).map((line) => line.replace(/^registry\//, ""));
  const old = new Set(names(base));
  return names(head)
    .filter((name) => !old.has(name))
    .map(valid)
    .sort();
}

/** The item names in a comma list such as VECTOYS_NEW_ITEMS. Unset or empty is none. */
export function parseItems(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map(valid);
}

/** The items that miss a snapshot in at least one project. */
export function missingBaselines(items: readonly string[], dir = SNAPSHOTS): string[] {
  return items.filter((name) => PROJECTS.some((project) => !existsSync(join(dir, project, `${name}.png`))));
}
