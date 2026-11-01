import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detect } from "../src/pm";

const work = mkdtempSync(join(tmpdir(), "vectoys-pm-"));

afterAll(() => rmSync(work, { recursive: true, force: true }));

function tree(name: string, files: Record<string, string>): string {
  const root = join(work, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("an app in a pnpm workspace installs with pnpm", () => {
  const root = tree("pnpm", {
    "site/package.json": JSON.stringify({ private: true, packageManager: "pnpm@11.1.0" }),
    "site/pnpm-lock.yaml": "",
    "site/pnpm-workspace.yaml": "packages:\n  - apps/*\n",
    "site/apps/web/package.json": JSON.stringify({ name: "web", dependencies: { ui: "workspace:*" } }),
  });
  expect(detect(join(root, "site/apps/web"))).toBe("pnpm");
});

test("the packageManager field wins over a lockfile", () => {
  const root = tree("field", { "package.json": JSON.stringify({ packageManager: "yarn@4.5.0" }), "package-lock.json": "{}" });
  expect(detect(root)).toBe("yarn");
});

test("the nearest folder with a lockfile or workspaces decides", () => {
  const lock = tree("lock", { "bun.lock": "", "apps/web/package.json": "{}", "apps/web/yarn.lock": "" });
  expect(detect(join(lock, "apps/web"))).toBe("yarn");
  expect(detect(lock)).toBe("bun");
  const yaml = tree("yaml", { "pnpm-workspace.yaml": "", "apps/web/package.json": "{}" });
  expect(detect(join(yaml, "apps/web"))).toBe("pnpm");
  const workspaces = tree("workspaces", { "package.json": JSON.stringify({ workspaces: ["apps/*"] }), "apps/web/package.json": "{}" });
  expect(detect(join(workspaces, "apps/web"))).toBe("npm");
});

test("a lockfile above the repository root does not count", () => {
  const root = tree("git", { "home/yarn.lock": "", "home/code/site/.git/HEAD": "", "home/code/site/package.json": "{}", "home/code/site/apps/web/package.json": "{}" });
  expect(detect(join(root, "home/code/site"))).toBe("npm");
  expect(detect(join(root, "home/code/site/apps/web"))).toBe("npm");
  const file = tree("gitfile", { "home/yarn.lock": "", "home/site/.git": "gitdir: ../wt", "home/site/package.json": "{}" });
  expect(detect(join(file, "home/site"))).toBe("npm");
});
