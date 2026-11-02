import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Context } from "../src/commands";
import { create } from "../src/create";
import { CLOSED, listed, readIndex, registryUrls, submit, type Ran, type Run } from "../src/submit";

const repo = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "vectoys-submit-test-"));
symlinkSync(join(repo, "registry/floppy/node_modules"), join(work, "node_modules"));
let server: ReturnType<typeof Bun.serve>;
let origin = "";

beforeAll(() => {
  const indexes: Record<string, unknown> = {
    "/r/index.json": { name: "acme", homepage: "https://acme.dev", items: [{ name: "thing" }, { name: "other" }] },
    "/bad/index.json": { items: [{ title: "No name" }] },
    "/empty.json": { name: "empty", items: [] },
  };
  server = Bun.serve({ port: 0, fetch: (request) => Response.json(indexes[new URL(request.url).pathname] ?? {}, { status: new URL(request.url).pathname in indexes ? 200 : 404 }) });
  origin = server.url.origin;
});
afterAll(() => {
  server.stop(true);
  rmSync(work, { recursive: true, force: true });
});

function context() {
  const lines: string[] = [];
  const given: Context = { cwd: work, registry: undefined, registryFlag: undefined, yes: false, overwrite: false, install: false, log: (line) => lines.push(line) };
  return { context: given, lines };
}

/** A fake gh and git: records each call, clones into an empty folder and keeps what the commit holds; `open` is a pull request already open from the branch. */
function fake(existing?: string, open?: string) {
  const calls: string[] = [];
  const committed: Record<string, string> = {};
  const runner: Run = (command, args, cwd): Ran => {
    calls.push([command, ...args].join(" "));
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    if (command === "git" && args[0] === "config") return ok("Ada Lovelace\n");
    if (command === "gh" && args[0] === "api") return ok("octo\n");
    if (command === "gh" && args[1] === "clone") {
      const clone = args[3] ?? "";
      mkdirSync(clone, { recursive: true });
      if (existing) writeFileSync(join(clone, "registries.json"), existing);
      return ok();
    }
    if (command === "git" && args[0] === "add") {
      for (const path of readdirSync(cwd, { recursive: true, withFileTypes: true })) {
        if (path.isFile()) committed[join(path.parentPath, path.name).slice(cwd.length + 1)] = readFileSync(join(path.parentPath, path.name), "utf8");
      }
    }
    if (command === "git" && args[0] === "ls-remote" && open) return ok(`abc123\t${args[2]}\n`);
    if (command === "gh" && args[0] === "pr" && args[1] === "list") return ok(JSON.stringify(open ? [{ url: open }] : []));
    if (command === "gh" && args[0] === "pr") return ok("https://github.com/vinenastudio/vectoys/pull/7\n");
    return ok();
  };
  return { runner, calls, committed };
}

test("submit opens a pull request that adds the item's files to the registry", async () => {
  create(context().context, "plate", undefined);
  writeFileSync(join(work, "plate/preview.html"), "<p>not sent</p>");
  const { context: here, lines } = context();
  const { runner, calls, committed } = fake();
  const url = await submit(here, "plate", { registry: undefined, dryRun: false, submissionsOpen: true, run: runner });
  expect(url).toBe("https://github.com/vinenastudio/vectoys/pull/7");
  expect(calls[0]).toBe("gh api user --jq .login");
  expect(calls[1]).toBe("gh repo fork vinenastudio/vectoys --clone=false");
  expect(calls[2]).toBe("gh repo sync octo/vectoys --branch main");
  expect(calls[3]).toMatch(/^gh repo clone octo\/vectoys \S+ -- --depth 1$/);
  expect(calls.slice(4, 10)).toEqual([
    "git checkout -b item/plate",
    "git add --all",
    "git commit -m Add the plate item",
    "git ls-remote origin refs/heads/item/plate",
    "git push --force-with-lease=refs/heads/item/plate: --set-upstream origin item/plate",
    "gh pr list --repo vinenastudio/vectoys --head octo:item/plate --state open --json url",
  ]);
  expect(calls[10]).toStartWith("gh pr create --repo vinenastudio/vectoys --base main --head octo:item/plate --title Add the plate item --body Adds `registry/plate`");
  expect(calls[10]).toContain("- pass: Plate renders on the server");
  expect(calls[10]).toContain("I agree to license it under the MIT license.");
  expect(calls).toHaveLength(11);
  expect(Object.keys(committed).sort()).toEqual([
    "registry/plate/item.json",
    "registry/plate/package.json",
    "registry/plate/src/geometry.ts",
    "registry/plate/src/plate.tsx",
    "registry/plate/test/plate.test.tsx",
    "registry/plate/tsconfig.json",
  ]);
  expect(lines.at(-1)).toBe("Opened https://github.com/vinenastudio/vectoys/pull/7");
}, 30_000);

test("submit copies an item made outside the repository in the form registry/ items have", async () => {
  const { runner, committed } = fake();
  await submit(context().context, "plate", { registry: undefined, dryRun: false, submissionsOpen: true, run: runner });
  const pkg = JSON.parse(committed["registry/plate/package.json"] ?? "");
  expect(pkg.dependencies).toEqual({ "@vinena/vectoys": "workspace:*", "@vinena/vectoys-react": "workspace:*" });
  expect(pkg.devDependencies).toEqual({ "@types/react": "19.0.0", "@types/react-dom": "19.0.0", react: "19.0.0", "react-dom": "19.0.0" });
  expect(JSON.parse(committed["registry/plate/tsconfig.json"] ?? "")).toEqual(JSON.parse(readFileSync(join(repo, "registry/floppy/tsconfig.json"), "utf8")));
}, 30_000);

test("a second submit pushes the branch again and updates the pull request already open", async () => {
  const { context: here, lines } = context();
  const { runner, calls } = fake(undefined, "https://github.com/vinenastudio/vectoys/pull/7");
  expect(await submit(here, "plate", { registry: undefined, dryRun: false, submissionsOpen: true, run: runner })).toBe("https://github.com/vinenastudio/vectoys/pull/7");
  expect(calls).toContain("gh repo sync octo/vectoys --branch main");
  expect(calls).toContain("git push --force-with-lease=refs/heads/item/plate:abc123 --set-upstream origin item/plate");
  expect(calls.at(-1)).toBe("gh pr list --repo vinenastudio/vectoys --head octo:item/plate --state open --json url");
  expect(calls.some((call) => call.startsWith("gh pr create"))).toBe(false);
  expect(lines.at(-1)).toBe("Updated https://github.com/vinenastudio/vectoys/pull/7");
}, 30_000);

test("while submissions are closed, submit checks the item, says what it would do and calls no gh", async () => {
  create(context().context, "closed", undefined);
  const { context: here, lines } = context();
  const { runner, calls } = fake();
  expect(await submit(here, "closed", { registry: undefined, dryRun: false, run: runner })).toBeUndefined();
  expect(calls).toEqual([]);
  expect(lines).toContain("  pass  Closed renders on the server");
  expect(lines).toContain("  3. Make the branch item/closed");
  expect(lines).toContain("Pull request title: Add the closed item");
  expect(lines.at(-1)).toBe(CLOSED);
}, 30_000);

test("--dry-run sends nothing even when submissions are open", async () => {
  const { context: here, lines } = context();
  const { runner, calls } = fake();
  await submit(here, "closed", { registry: undefined, dryRun: true, submissionsOpen: true, run: runner });
  expect(calls).toEqual([]);
  expect(lines.at(-1)).toBe(CLOSED);
}, 30_000);

test("a failing check stops submit before gh", async () => {
  create(context().context, "branded", undefined);
  const path = join(work, "branded/item.json");
  writeFileSync(path, readFileSync(path, "utf8").replace('"title": "Branded"', '"title": "Xbox slab"'));
  const { runner, calls } = fake();
  await expect(submit(context().context, "branded", { registry: undefined, dryRun: false, submissionsOpen: true, run: runner })).rejects.toThrow("1 of 10 checks fail.");
  expect(calls).toEqual([]);
}, 30_000);

test("submit --registry opens a pull request that lists the registry in registries.json, sorted", async () => {
  const { context: here } = context();
  const { runner, calls, committed } = fake(JSON.stringify([{ name: "zeta", url: "https://zeta.dev/r", author: "Zeta" }]));
  await submit(here, undefined, { registry: `${origin}/r/`, dryRun: false, submissionsOpen: true, run: runner });
  expect(calls).toContain("git checkout -b registry/acme");
  expect(calls).toContain("git commit -m List the acme registry");
  expect(JSON.parse(committed["registries.json"] ?? "")).toEqual([
    { name: "acme", url: `${origin}/r`, author: "Ada Lovelace" },
    { name: "zeta", url: "https://zeta.dev/r", author: "Zeta" },
  ]);
});

test("submit --registry while closed validates the index and calls no gh", async () => {
  const { context: here, lines } = context();
  const { runner, calls } = fake();
  await submit(here, undefined, { registry: `${origin}/r/index.json`, dryRun: false, run: runner });
  expect(calls).toEqual(["git config user.name"]);
  expect(lines).toContain("  pass  it lists 2 items");
  expect(lines).toContain(`  4. Add {"name":"acme","url":"${origin}/r","author":"Ada Lovelace"} to registries.json, sorted by name`);
  expect(lines.at(-1)).toBe(CLOSED);
});

test("a bad registry index stops submit", async () => {
  const { runner, calls } = fake();
  const go = (url: string) => submit(context().context, undefined, { registry: url, dryRun: false, submissionsOpen: true, run: runner });
  await expect(go(`${origin}/bad`)).rejects.toThrow(`${origin}/bad/index.json is not a vectoys registry index: it lists {"title":"No name"}, which has no item name.`);
  await expect(go(`${origin}/empty.json`)).rejects.toThrow("it lists no items.");
  await expect(go(`${origin}/gone`)).rejects.toThrow("answered 404");
  expect(calls).toEqual([]);
});

test("registry URLs, indexes and listings", () => {
  expect(registryUrls("https://acme.dev/r/")).toEqual({ index: "https://acme.dev/r/index.json", base: "https://acme.dev/r" });
  expect(registryUrls("https://acme.dev/r/registry.json")).toEqual({ index: "https://acme.dev/r/registry.json", base: "https://acme.dev/r" });
  expect(readIndex([])).toBe("it is not a JSON object");
  expect(readIndex({ name: "a b", items: [{ name: "x" }] })).toEqual({ name: undefined, items: 1 });
  const a = { name: "a", url: "u", author: "x" };
  expect(listed([{ ...a, name: "c" }, { ...a, author: "old" }], a)).toEqual([a, { ...a, name: "c" }]);
});
