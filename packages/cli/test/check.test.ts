import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ALLOWED_DEPENDENCIES, accessibleName, brands, check, checks, markupSafety, safety, sources } from "../src/check";
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
    "  pass  the code is safe: no scripts, eval, network calls or outside imports",
    "  pass  Plate renders on the server",
    "  pass  the markup has no NaN or Infinity",
    "  pass  two renders give the same markup",
    "  pass  the markup has no scripts or outside links",
    "  pass  the rendered text names no brands",
    '  pass  the root is role="img" with an aria-label',
    "All 10 checks pass.",
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
  expect(() => check(quiet, "branded")).toThrow("2 of 10 checks fail.");
}, 30_000);

test("a bad item.json fails before anything renders", () => {
  const { folder, edit } = item("bad");
  edit("item.json", (text) => text.replace('"license": "MIT"', '"licence": "MIT"'));
  expect(failed(folder)).toEqual(['item.json needs a "license"']);
  writeFileSync(join(folder, "item.json"), "{ name: bad }");
  expect(failed(folder)[0]).toStartWith("item.json is not valid JSON");
  writeFileSync(join(folder, "item.json"), JSON.stringify({ name: "bad", title: "Bad", description: "Bad", license: "MIT", files: ["src/gone.tsx"] }));
  expect(failed(folder)).toEqual(['files lists "src/gone.tsx", which is not a file in the folder']);
  writeFileSync(join(folder, "item.json"), JSON.stringify({ name: "bad", title: "Bad", description: "Bad", license: "MIT", files: ["src/bad.tsx"], author: 42 }));
  expect(failed(folder)).toEqual(['item.json "author" must be one line of text like "Name (https://site)"']);
  writeFileSync(join(folder, "item.json"), JSON.stringify({ name: "bad", title: "Bad", description: "Bad", license: "MIT", files: ["src/bad.tsx"], credit: "" }));
  expect(failed(folder)).toEqual(['item.json "credit" must be one line of text']);
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

// The safety lines for one file, src/toy.tsx, with `code` in it, read by bun as `check` reads it.
let scans = 0;
function unsafe(code: string, extra: Record<string, string> = {}, dependencies: string[] = ALLOWED_DEPENDENCIES): string[] {
  const folder = join(work, `scan-${scans++}`);
  const files = { "src/toy.tsx": code, ...extra };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(folder, path, ".."), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
  const read = sources(folder, Object.keys(files));
  if (typeof read === "string") throw new Error(read);
  return safety(read, { dependencies });
}

test("safe code passes, with comments, labels and words that only look like the rules", () => {
  const code = `
    // We never fetch(anything) or eval(it), and no <script> runs here.
    /* new Function("x"), localStorage, https://example.com */
    import { memo } from "react";
    import { jsx } from "react/jsx-runtime";
    import { project } from "@vinena/vectoys";
    import { useTilt } from "@vinena/vectoys-react/tilt";
    import { size } from "./geometry";
    import type { Thing } from "some-types";
    export const Toy = memo(function Toy() {
      setTimeout(() => {}, 10);
      return <svg role="img" aria-label="Fetch the ball, a script for a play" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0" fill={\`url(#toy-shade)\`} />
        <a href="#top">top</a>
      </svg>;
    });`;
  expect(unsafe(code, { "src/geometry.ts": "export const size = 1;" })).toEqual([]);
});

test("each unsafe thing in the code fails, naming the file and what it found", () => {
  const cases: [string, string][] = [
    ["const a = <script>{'1'}</script>;", 'src/toy.tsx makes a script element: "script"'],
    ['const a = "<script src=a.js></script>";', "src/toy.tsx has a <script> tag: <script"],
    ['const a = document.createElement("script");', 'src/toy.tsx makes a script element: "script"'],
    ["const a = <div dangerouslySetInnerHTML={{ __html: x }} />;", "src/toy.tsx sets HTML from a string: dangerouslySetInnerHTML"],
    ["node.innerHTML = x;", "src/toy.tsx sets HTML from a string: innerHTML"],
    ['eval("1");', "src/toy.tsx calls eval: eval("],
    ['const f = new Function("return 1");', "src/toy.tsx makes a function from a string: Function("],
    ['const f = (() => {}).constructor("return 1");', "src/toy.tsx makes a function from a string: .constructor"],
    ['setTimeout("go()", 10);', 'src/toy.tsx passes a string to setTimeout or setInterval: setTimeout("'],
    ["setInterval(`go()`, 10);", "src/toy.tsx passes a string to setTimeout or setInterval: setInterval(`"],
    ["fetch(url);", "src/toy.tsx calls fetch: fetch("],
    ["window.fetch(url);", "src/toy.tsx calls fetch: fetch("],
    ['window["fetch"](url);', 'src/toy.tsx names a blocked browser feature in a string: "fetch"'],
    ["new XMLHttpRequest();", "src/toy.tsx makes a network call: XMLHttpRequest"],
    ["new WebSocket(url);", "src/toy.tsx makes a network call: WebSocket"],
    ["new EventSource(url);", "src/toy.tsx makes a network call: EventSource"],
    ["navigator.sendBeacon(url, data);", "src/toy.tsx makes a network call: sendBeacon"],
    ['importScripts("a.js");', "src/toy.tsx makes a network call: importScripts"],
    ['const a = require("fs");', "src/toy.tsx calls require: require("],
    ['localStorage.setItem("a", "b");', "src/toy.tsx uses browser storage or cookies: localStorage"],
    ["sessionStorage.clear();", "src/toy.tsx uses browser storage or cookies: sessionStorage"],
    ['indexedDB.open("a");', "src/toy.tsx uses browser storage or cookies: indexedDB"],
    ["const a = document.cookie;", "src/toy.tsx uses browser storage or cookies: document.cookie"],
    ['const a = <image href="https://example.com/a.png" />;', 'src/toy.tsx has an outside URL: "https:'],
    ['const a = <image xlinkHref="//example.com/a.png" />;', 'src/toy.tsx has an outside URL: "//'],
    ['const a = <a href="javascript:go()">a</a>;', 'src/toy.tsx has an outside URL: "javascript:'],
    ['const a = <iframe src="data:text/html,hi" />;', 'src/toy.tsx has an outside URL: "data:text/html'],
    ['const a = <div style={{ background: "url(https://example.com/a.png)" }} />;', "src/toy.tsx loads a style from outside: url(https:"],
  ];
  for (const [code, line] of cases) expect({ code, lines: unsafe(code) }).toEqual({ code, lines: [line] });
});

test("imports outside the item's files and the allowed packages fail", () => {
  expect(unsafe('import _ from "lodash";')).toEqual(["src/toy.tsx imports lodash, which is not one of its files or @vinena/vectoys, @vinena/vectoys-react, react"]);
  expect(unsafe('import { render } from "react-dom";')).toEqual(["src/toy.tsx imports react-dom, which is not one of its files or @vinena/vectoys, @vinena/vectoys-react, react"]);
  expect(unsafe('import "./missing";')).toEqual(["src/toy.tsx imports ./missing, which is not one of its files or @vinena/vectoys, @vinena/vectoys-react, react"]);
  expect(unsafe('export * from "../../secrets";')).toEqual(["src/toy.tsx imports ../../secrets, which is not one of its files or @vinena/vectoys, @vinena/vectoys-react, react"]);
  expect(unsafe('const a = await import("./geometry");', { "src/geometry.ts": "export const a = 1;" })).toEqual(["src/toy.tsx has a dynamic import: import("]);
});

test("dependencies outside the allowed packages fail, and so does code that does not parse", () => {
  expect(unsafe("export const a = 1;", {}, ["@vinena/vectoys", "left-pad"])).toEqual(["item.json depends on left-pad, which is not @vinena/vectoys or @vinena/vectoys-react"]);
  expect(unsafe("const a = <div>;")[0]).toStartWith("src/toy.tsx does not parse: ");
});

test("unsafe code fails the check before anything renders", () => {
  const { folder, edit } = item("caller");
  edit("src/caller.tsx", (text) => `${text}\nawait fetch("https://example.com/track");\n`);
  expect(failed(folder)).toEqual(["src/caller.tsx calls fetch: fetch(", 'src/caller.tsx has an outside URL: "https:']);
  expect(checks(folder)).toHaveLength(5);
}, 30_000);

test("markup with a script or an outside link fails", () => {
  expect(markupSafety('<div role="img"><svg><path fill="url(#a)"></path><a href="#x"></a></svg></div>')).toEqual([]);
  expect(markupSafety("<div><script>alert(1)</script></div>")).toEqual(["the markup has a <script> tag: <script"]);
  expect(markupSafety('<svg><image xlink:href="https://example.com/a.png"></image></svg>')).toEqual(['the markup links outside: xlink:href="https:']);
  expect(markupSafety('<a href="javascript:go()">a</a>')).toEqual(['the markup links outside: href="javascript:']);
  expect(markupSafety('<div style="background:url(&quot;//example.com/a.png&quot;)"></div>')).toEqual(["the markup loads a style from outside: url(&quot;//"]);
});
