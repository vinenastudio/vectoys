import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { compilerOptions } from "../../../tsconfig.base.json";
import { checks, readItem } from "./check";
import { ITEM_NAME, type Context } from "./commands";
import { BASE_TSCONFIG } from "./create";
import { fetchJson } from "./fetch";

/** Whether submit sends anything: it only says what it would until vectoys launches. */
export const SUBMISSIONS_OPEN = false;

/** The repository items and registries are submitted to. */
export const UPSTREAM = "vinenastudio/vectoys";

export const CLOSED = "Submissions open when vectoys launches. Nothing was sent.";

export type Ran = { status: number; stdout: string; stderr: string };
/** Runs a program, gh or git, in `cwd`. */
export type Run = (command: string, args: string[], cwd: string) => Ran;

export const run: Run = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) {
    const missing = "code" in result.error && result.error.code === "ENOENT";
    throw new Error(missing ? `submit needs ${command}${command === "gh" ? ", the GitHub CLI: https://cli.github.com" : ""}.` : result.error.message);
  }
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
};

export type SubmitOptions = {
  registry: string | undefined;
  dryRun: boolean;
  /** Whether submissions are open; `SUBMISSIONS_OPEN` unless a test says. */
  submissionsOpen?: boolean;
  run?: Run;
};

/** A pull request to open: on `branch`, with the files `write` puts in a clone. */
type Change = { branch: string; title: string; body: string; steps: string[]; write: (clone: string, runner: Run) => void };

/** Runs `args` and gives back its output, or fails with what it printed. */
function must(runner: Run, command: string, args: string[], cwd: string): string {
  const result = runner(command, args, cwd);
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

/** The URL of the open pull request from `head`, if there is one. */
function openPullRequestFrom(head: string, runner: Run, cwd: string): string | undefined {
  const found: unknown = JSON.parse(must(runner, "gh", ["pr", "list", "--repo", UPSTREAM, "--head", head, "--state", "open", "--json", "url"], cwd) || "[]");
  const first: unknown = Array.isArray(found) ? found[0] : undefined;
  return typeof first === "object" && first !== null && "url" in first && typeof first.url === "string" ? first.url : undefined;
}

/**
 * Forks the upstream, syncs the fork's main, commits the change on a branch of
 * the fork and opens a pull request, or updates the one already open from that
 * branch; its URL and whether it was opened.
 */
function openPullRequest(change: Change, runner: Run, cwd: string): { url: string; opened: boolean } {
  const login = must(runner, "gh", ["api", "user", "--jq", ".login"], cwd);
  must(runner, "gh", ["repo", "fork", UPSTREAM, "--clone=false"], cwd);
  must(runner, "gh", ["repo", "sync", `${login}/vectoys`, "--branch", "main"], cwd);
  const work = mkdtempSync(join(tmpdir(), "vectoys-submit-"));
  try {
    const clone = join(work, "vectoys");
    must(runner, "gh", ["repo", "clone", `${login}/vectoys`, clone, "--", "--depth", "1"], work);
    must(runner, "git", ["checkout", "-b", change.branch], clone);
    change.write(clone, runner);
    must(runner, "git", ["add", "--all"], clone);
    must(runner, "git", ["commit", "-m", change.title], clone);
    // The shallow clone tracks only main, so the lease names the branch's commit on the fork, or none if it has no such branch.
    const ref = `refs/heads/${change.branch}`;
    const pushed = must(runner, "git", ["ls-remote", "origin", ref], clone).split("\t")[0] ?? "";
    must(runner, "git", ["push", `--force-with-lease=${ref}:${pushed}`, "--set-upstream", "origin", change.branch], clone);
    const head = `${login}:${change.branch}`;
    const open = openPullRequestFrom(head, runner, clone);
    if (open) return { url: open, opened: false };
    return { url: must(runner, "gh", ["pr", "create", "--repo", UPSTREAM, "--base", "main", "--head", head, "--title", change.title, "--body", change.body], clone), opened: true };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The steps every submission takes around its own. */
function steps(change: Pick<Change, "branch" | "title">, own: string[]): string[] {
  return [
    `Fork ${UPSTREAM} to your GitHub account with gh and bring its main up to date`,
    "Clone the fork into a temporary folder",
    `Make the branch ${change.branch}`,
    ...own,
    `Commit "${change.title}" and push the branch to the fork`,
    `Open a pull request to ${UPSTREAM} main, or update the one already open from the branch`,
  ];
}

/** The bun CI installs with, in .github/workflows/ci.yml. */
export const CI_BUN = "1.3.14";

/** The oldest bun whose `install --lockfile-only` keeps bun.lock as CI's bun writes it; older ones drop its configVersion. */
export const MIN_BUN = "1.3.2";

const OLD_BUN = `Update bun to ${CI_BUN}, the version CI uses, and submit again.`;

/** Whether the version `have` is `want` or later. */
export function atLeast(have: string, want: string): boolean {
  const parts = (version: string) => (/^(\d+)\.(\d+)\.(\d+)/.exec(version) ?? []).slice(1).map(Number);
  const [a, b] = [parts(have), parts(want)];
  if (a.length !== 3) return false;
  for (let at = 0; at < 3; at++) if ((a[at] ?? 0) !== (b[at] ?? 0)) return (a[at] ?? 0) > (b[at] ?? 0);
  return true;
}

/** Fails unless the bun here is `MIN_BUN` or later, so the bun.lock it writes is the one CI reads. */
function needBun(runner: Run, cwd: string) {
  const version = must(runner, "bun", ["--version"], cwd);
  if (!atLeast(version, MIN_BUN)) throw new Error(`bun ${version} is older than ${MIN_BUN} and rewrites bun.lock beyond the item's lines. ${OLD_BUN}`);
}

/** The files of an item folder that go into the registry: those item.json lists, its package, tsconfig, index and tests. */
export function itemFiles(dir: string, listed: string[]): string[] {
  const extra = ["package.json", "tsconfig.json", "src/index.ts", "test"].filter((path) => existsSync(join(dir, path)));
  return [...new Set(["item.json", ...listed, ...extra])];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Turns an item copied from outside the repository into the form registry/ items have: workspace packages and the shared tsconfig. */
export function inRepoForm(folder: string) {
  const pkgPath = join(folder, "package.json");
  if (existsSync(pkgPath)) {
    const pkg: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (!isRecord(pkg)) throw new Error("The item's package.json is not an object.");
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const deps = pkg[field];
      if (!isRecord(deps)) continue;
      for (const name of Object.keys(deps)) if (name.startsWith("@vectoys/") || name === "@vinena/vectoys" || name.startsWith("@vinena/vectoys-")) deps[name] = "workspace:*";
      if (field === "devDependencies") delete deps["@types/bun"];
    }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  const tsPath = join(folder, "tsconfig.json");
  if (existsSync(tsPath)) {
    const tsconfig: unknown = JSON.parse(readFileSync(tsPath, "utf8"));
    if (!isRecord(tsconfig)) throw new Error("The item's tsconfig.json is not an object.");
    const own = isRecord(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {};
    const kept = Object.fromEntries(Object.entries(own).filter(([key]) => !(key in compilerOptions)));
    writeFileSync(tsPath, `${JSON.stringify({ extends: BASE_TSCONFIG, ...tsconfig, compilerOptions: kept }, null, 2)}\n`);
  }
}

function itemChange(context: Context, dir: string): Change {
  const shown = relative(context.cwd, dir) || ".";
  context.log(`Checking ${shown}`);
  const results = checks(dir);
  for (const result of results) context.log(`  ${result.pass ? "pass" : "FAIL"}  ${result.line}`);
  const failed = results.filter((result) => !result.pass).length;
  if (failed > 0) throw new Error(`${failed} of ${results.length} checks fail. Fix them, then submit again.`);
  const item = readItem(dir);
  if (typeof item === "string") throw new Error(item);

  const files = itemFiles(dir, item.files);
  const branch = `item/${item.name}`;
  const title = `Add the ${item.name} item`;
  const body = [
    `Adds \`registry/${item.name}\`: ${item.description}`,
    "",
    "## vectoys check",
    "",
    ...results.map((result) => `- ${result.pass ? "pass" : "FAIL"}: ${result.line}`),
    "",
    "## Author",
    "",
    "- [ ] I made this item myself, and it draws no maker's product.",
    "- [ ] I agree to license it under the MIT license.",
  ].join("\n");
  return {
    branch,
    title,
    body,
    steps: steps({ branch, title }, [`Copy ${files.join(", ")} into registry/${item.name}/`, "Add the item's package to bun.lock with bun install --lockfile-only"]),
    write: (clone, runner) => {
      for (const file of files) {
        const to = join(clone, "registry", item.name, file);
        mkdirSync(dirname(to), { recursive: true });
        cpSync(join(dir, file), to, { recursive: true });
      }
      inRepoForm(join(clone, "registry", item.name));
      // The item is a new workspace package, and CI installs with a frozen lockfile.
      must(runner, "bun", ["install", "--lockfile-only", "--ignore-scripts"], clone);
      // The item only adds lines; a deleted line means this bun rewrote what CI's bun wrote.
      const deleted = must(runner, "git", ["diff", "--numstat", "bun.lock"], clone)
        .split("\n")
        .some((line) => Number(line.split("\t")[1]) > 0);
      if (deleted) throw new Error(`bun ${must(runner, "bun", ["--version"], clone)} rewrote bun.lock beyond the item's lines. ${OLD_BUN}`);
    },
  };
}

export type Listing = { name: string; url: string; author: string };

/** The URL of a registry's index, and the registry's base URL, from what was given. */
export function registryUrls(given: string): { index: string; base: string } {
  const trimmed = given.replace(/\/+$/, "");
  if (trimmed.endsWith(".json")) return { index: trimmed, base: trimmed.slice(0, trimmed.lastIndexOf("/")) };
  return { index: `${trimmed}/index.json`, base: trimmed };
}

/** A registry index's name and how many items it lists, or what is wrong with it: it needs items, each with an item name. */
export function readIndex(value: unknown): { name: string | undefined; items: number } | string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "it is not a JSON object";
  if (!("items" in value) || !Array.isArray(value.items)) return 'it has no "items" list';
  if (value.items.length === 0) return "it lists no items";
  const bad = value.items.find((item: unknown) => !(typeof item === "object" && item !== null && "name" in item && typeof item.name === "string" && ITEM_NAME.test(item.name)));
  if (bad !== undefined) return `it lists ${JSON.stringify(bad)}, which has no item name`;
  const name = "name" in value && typeof value.name === "string" && ITEM_NAME.test(value.name) ? value.name : undefined;
  return { name, items: value.items.length };
}

/** `registries` with `listing` in it, in place of one of the same name, sorted by name. */
export function listed(registries: Listing[], listing: Listing): Listing[] {
  return [...registries.filter((entry) => entry.name !== listing.name), listing].sort((a, b) => a.name.localeCompare(b.name));
}

function isListings(value: unknown): value is Listing[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === "object" && entry !== null && "name" in entry && typeof entry.name === "string");
}

async function listingChange(context: Context, given: string, runner: Run): Promise<Change> {
  const { index, base } = registryUrls(given);
  context.log(`Reading ${index}`);
  const read = readIndex(await fetchJson<unknown>(index));
  if (typeof read === "string") throw new Error(`${index} is not a vectoys registry index: ${read}.`);
  const { items } = read;
  const name = read.name ?? new URL(base).hostname;
  context.log(`  pass  it lists ${items} item${items === 1 ? "" : "s"}`);

  const author = runner("git", ["config", "user.name"], context.cwd).stdout.trim();
  if (!author) throw new Error('Set your name for git first, as git config --global user.name "Your Name".');
  const listing: Listing = { name, url: base, author };
  const branch = `registry/${name}`;
  const title = `List the ${name} registry`;
  const body = [
    `Lists the ${name} registry, at ${base}, by ${author}. Its index lists ${items} item${items === 1 ? "" : "s"}.`,
    "",
    "- [ ] I run this registry, and its items draw no maker's product.",
  ].join("\n");
  return {
    branch,
    title,
    body,
    steps: steps({ branch, title }, [`Add ${JSON.stringify(listing)} to registries.json, sorted by name`]),
    write: (clone) => {
      const path = join(clone, "registries.json");
      const found: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
      if (!isListings(found)) throw new Error("registries.json in the fork is not a list of registries.");
      writeFileSync(path, `${JSON.stringify(listed(found, listing), null, 2)}\n`);
    },
  };
}

/** Submits an item folder, or with `registry` a registry, as a pull request to vectoys; until launch it only says how. */
export async function submit(context: Context, given: string | undefined, options: SubmitOptions): Promise<string | undefined> {
  const runner = options.run ?? run;
  const change = options.registry ? await listingChange(context, options.registry, runner) : itemChange(context, resolve(context.cwd, given ?? "."));
  if (!(options.submissionsOpen ?? SUBMISSIONS_OPEN) || options.dryRun) {
    context.log("");
    context.log("submit would:");
    change.steps.forEach((step, at) => context.log(`  ${at + 1}. ${step}`));
    context.log("");
    context.log(`Pull request title: ${change.title}`);
    context.log("Pull request body:");
    for (const line of change.body.split("\n")) context.log(line ? `  ${line}` : "");
    context.log("");
    context.log(CLOSED);
    return undefined;
  }
  if (!options.registry) needBun(runner, context.cwd);
  const { url, opened } = openPullRequest(change, runner, context.cwd);
  context.log(`${opened ? "Opened" : "Updated"} ${url}`);
  return url;
}
