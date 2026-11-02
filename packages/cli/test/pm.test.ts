import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detect, installCommand, missing, atLeast } from "../src/pm";

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

test("a version meets a range when it is at least the range's base version", () => {
  expect(atLeast("0.3.0", "^0.3.0")).toBe(true);
  expect(atLeast("0.3.9", "^0.3.0")).toBe(true);
  expect(atLeast("0.2.1", "^0.3.0")).toBe(false);
  // Newer versions are kept, so an install never goes down.
  expect(atLeast("0.4.0", "^0.3.0")).toBe(true);
  expect(atLeast("0.5.2", "^0.3.0")).toBe(true);
  expect(atLeast("2.0.0", "^1.2.0")).toBe(true);
  expect(atLeast("1.1.9", "^1.2.0")).toBe(false);
  expect(atLeast("0.3.1", "0.3.0")).toBe(true);
  expect(atLeast("0.2.9", "0.3.0")).toBe(false);
  // Other ranges, and versions that are not semver, count as met.
  expect(atLeast("0.1.0", ">=0.3")).toBe(true);
  expect(atLeast("workspace:*", "^0.3.0")).toBe(true);
  expect(atLeast("0.1.0", "")).toBe(true);
});

test("a prerelease is below its release", () => {
  expect(atLeast("0.4.0-next.1", "^0.4.0")).toBe(false);
  expect(atLeast("0.4.0-next.1", "^0.3.0")).toBe(true);
  expect(atLeast("0.4.0-next.1", "^0.4.0-next.1")).toBe(true);
  expect(atLeast("0.4.0-next.2", "^0.4.0-next.1")).toBe(true);
  expect(atLeast("0.4.0-next.10", "^0.4.0-next.9")).toBe(true);
  expect(atLeast("0.4.0-next.0", "^0.4.0-next.1")).toBe(false);
  expect(atLeast("0.4.0", "^0.4.0-next.1")).toBe(true);
  expect(atLeast("0.4.0-alpha", "^0.4.0-beta")).toBe(false);
  expect(atLeast("0.4.0-1", "^0.4.0-alpha")).toBe(false);
});

test("a newer installed version is never replaced by an older one", () => {
  const root = tree("newer", {
    "package.json": JSON.stringify({ dependencies: { "@vinena/vectoys-react": "^0.5.0" } }),
    "node_modules/@vinena/vectoys-react/package.json": JSON.stringify({ version: "0.5.2" }),
  });
  expect(missing(root, ["@vinena/vectoys-react@^0.3.0"])).toEqual([]);
  const listedOnly = tree("newer-listed", { "package.json": JSON.stringify({ dependencies: { "@vinena/vectoys-react": "^0.5.0" } }) });
  expect(missing(listedOnly, ["@vinena/vectoys-react@^0.3.0"])).toEqual([]);
  const pre = tree("prerelease", {
    "package.json": JSON.stringify({ dependencies: { "@vinena/vectoys-react": "0.4.0-next.1" } }),
  });
  expect(missing(pre, ["@vinena/vectoys-react@^0.4.0"])).toEqual(["@vinena/vectoys-react@^0.4.0"]);
});

test("names built into objects, such as constructor, are not listed packages", () => {
  const root = tree("builtin", { "package.json": JSON.stringify({ dependencies: {} }) });
  expect(missing(root, ["constructor@^1.0.0", "toString"])).toEqual(["constructor@^1.0.0", "toString"]);
});

test("a package listed at a version too old for the range is installed again, at the range", () => {
  const listed = tree("ranges", {
    "package.json": JSON.stringify({ dependencies: { "@vinena/vectoys": "^0.3.1", "@vinena/vectoys-react": "^0.2.1", react: "19.0.0" }, devDependencies: { linked: "workspace:*" } }),
  });
  const wanted = ["@vinena/vectoys@^0.3.0", "@vinena/vectoys-react@^0.3.0", "react", "linked@^1.0.0", "left-pad@^1.0.0"];
  expect(missing(listed, wanted)).toEqual(["@vinena/vectoys-react@^0.3.0", "left-pad@^1.0.0"]);
  expect(installCommand("npm", missing(listed, wanted))).toEqual(["npm", ["install", "@vinena/vectoys-react@^0.3.0", "left-pad@^1.0.0"]]);
});

test("the installed version in node_modules wins over the range package.json gives", () => {
  const root = tree("installed", {
    "package.json": JSON.stringify({ dependencies: { "@vinena/vectoys": "^0.2.0", "@vinena/vectoys-react": "^0.3.0" } }),
    "node_modules/@vinena/vectoys/package.json": JSON.stringify({ version: "0.3.2" }),
    "node_modules/@vinena/vectoys-react/package.json": JSON.stringify({ version: "0.2.1" }),
  });
  expect(missing(root, ["@vinena/vectoys@^0.3.0", "@vinena/vectoys-react@^0.3.0"])).toEqual(["@vinena/vectoys-react@^0.3.0"]);
  expect(missing(join(root, "nowhere"), ["@vinena/vectoys@^0.3.0"])).toEqual(["@vinena/vectoys@^0.3.0"]);
});
