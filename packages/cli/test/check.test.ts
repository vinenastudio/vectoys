import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { accessibleName, brands, check, checks } from "../src/check";
import type { Context } from "../src/commands";
import { create } from "../src/create";

// New items in a temporary folder, with the packages an item in this
// repository has installed, as they would be once its own are.
const repo = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "vectoys-check-test-"));
symlinkSync(join(repo, "registry/floppy/node_modules"), join(work, "node_modules"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const quiet: Context = { cwd: work, registry: undefined, registryFlag: undefined, yes: false, overwrite: false, install: false, log: () => {} };

function item(name: string) {
  create(quiet, name, undefined);
  const folder = join(work, name);
  const edit = (file: string, change: (text: string) => string) => writeFileSync(join(folder, file), change(readFileSync(join(folder, file), "utf8")));
  return { folder, edit };
}

const failed = (folder: string) => checks(folder).filter((result) => !result.pass).map((result) => result.line);

test("a new item passes every check", () => {
  item("plate");
  const lines: string[] = [];
  check({ ...quiet, log: (line) => lines.push(line) }, "plate");
  expect(lines).toEqual([
    "Checking plate",
    "  pass  item.json has what the registry needs",
    expect.stringMatching(/^ {2}pass {2}the files are \d+\.\d KB, under 96\.0 KB$/),
    "  pass  item.json names no brands",
    "  pass  Plate renders on the server",
    "  pass  the markup has no NaN or Infinity",
    "  pass  two renders give the same markup",
    "  pass  the rendered text names no brands",
    '  pass  the root is role="img" with an aria-label',
    "All 8 checks pass.",
  ]);
}, 30_000);

test("a render with NaN in it fails", () => {
  const { folder, edit } = item("broken");
  edit("src/broken.tsx", (text) => text.replace("style={style}>", "style={{ ...style, width: Number.NaN }}>"));
  expect(failed(folder)).toEqual(["the markup has NaN in it"]);
}, 30_000);

test("brand names fail in item.json and in what renders", () => {
  const { folder, edit } = item("branded");
  edit("item.json", (text) => text.replace('"title": "Branded"', '"title": "Xbox slab"'));
  edit("src/branded.tsx", (text) => text.replace('label = "Branded"', 'label = "An iPhone on a desk"'));
  expect(failed(folder)).toEqual(["item.json names brands: xbox", "the rendered text names brands: iphone"]);
  expect(() => check(quiet, "branded")).toThrow("2 of 8 checks fail.");
}, 30_000);

test("a bad item.json fails before anything renders", () => {
  const { folder, edit } = item("bad");
  edit("item.json", (text) => text.replace('"license": "MIT"', '"licence": "MIT"'));
  expect(failed(folder)).toEqual(['item.json needs a "license"']);
  writeFileSync(join(folder, "item.json"), "{ name: bad }");
  expect(failed(folder)[0]).toStartWith("item.json is not valid JSON");
  writeFileSync(join(folder, "item.json"), JSON.stringify({ name: "bad", title: "Bad", description: "Bad", license: "MIT", files: ["src/gone.tsx"] }));
  expect(failed(folder)).toEqual(['files lists "src/gone.tsx", which is not a file in the folder']);
});

test("files must be regular files, not folders or symlinks", () => {
  const { folder, edit } = item("linked");
  edit("item.json", (text) => text.replace('"src/geometry.ts"', '"src"'));
  expect(failed(folder)).toEqual(['files lists "src", which is a folder, not a regular file']);
  edit("item.json", (text) => text.replace('"src"', '"src/link.ts"'));
  symlinkSync(join(repo, "package.json"), join(folder, "src/link.ts"));
  expect(failed(folder)).toEqual(['files lists "src/link.ts", which is a symlink, not a regular file']);
});

test("brand names match whole words in any case, and plain words only inside a product's name", () => {
  expect(brands("An iPhone, an XBOX and a Surface  Pro, not an imacs")).toEqual(["iphone", "xbox", "surface pro"]);
  expect(brands("browser windows on the main surface of a galaxy of pixels")).toEqual([]);
  expect(brands("an Apple Watch by apple")).toEqual(["apple watch", "apple"]);
});

test("every item in the registry passes every check", () => {
  const items = readdirSync(join(repo, "registry"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  expect(items.length).toBeGreaterThan(0);
  for (const entry of items) expect({ item: entry.name, failed: failed(join(repo, "registry", entry.name)) }).toEqual({ item: entry.name, failed: [] });
}, 60_000);

test("markup is named by a labelled image root or by its labelled controls", () => {
  expect(accessibleName('<div role="img" aria-label="A die"><svg></svg></div>')).toBe('the root is role="img" with an aria-label');
  expect(accessibleName('<div role="img" aria-label=" "></div>')).toBeUndefined();
  expect(accessibleName('<div role="group" aria-label="Browser window"><a href="/x"></a></div>')).toBe('the root is role="group" with an aria-label');
  expect(accessibleName('<div><button type="button"><span>Save</span></button><a href="/x" aria-label="Get it"></a></div>')).toBe("its 2 controls are labelled");
  expect(accessibleName('<div><button type="button"></button></div>')).toBeUndefined();
  expect(accessibleName("<div><svg></svg></div>")).toBeUndefined();
});
