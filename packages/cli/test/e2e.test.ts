import { afterAll, beforeAll, expect, test } from "bun:test";
import { buildRegistry } from "@vectoys/registry-build";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The built CLI, run with node against a registry built from this repo and
// served over HTTP, in a fresh project, as someone would use it.
const repo = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "vectoys-e2e-"));
const out = join(work, "r");
const cli = join(work, "cli.js");
const project = join(work, "project");
let server: ReturnType<typeof Bun.serve>;
let registry = "";

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const path = new URL(request.url).pathname.replace(/^\/r\//, "");
      if (path.includes("..")) return new Response("no", { status: 400 });
      const file = Bun.file(join(out, path));
      return file.exists().then((found) => (found ? new Response(file) : new Response("not found", { status: 404 })));
    },
  });
  registry = `${server.url.origin}/r`;
  await buildRegistry({ root: repo, out, baseUrl: registry });
  const build = Bun.spawnSync(["bun", "build", "src/index.ts", "--target", "node", "--outfile", cli], { cwd: join(import.meta.dir, "..") });
  if (build.exitCode !== 0) throw new Error(build.stderr.toString());

  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "site", private: true, dependencies: { react: "19.0.0" } }));
  writeFileSync(join(project, "bun.lock"), "");
});

afterAll(() => {
  server.stop(true);
  rmSync(work, { recursive: true, force: true });
});

async function run(...args: string[]) {
  return runIn(project, ...args);
}

async function runIn(cwd: string, ...args: string[]) {
  const child = Bun.spawn(["node", cli, ...args], {
    cwd,
    env: { ...process.env, VECTOYS_REGISTRY: registry },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}

const target = (...path: string[]) => join(project, "src/components/vectoys", ...path);

test("list shows the registry's items", async () => {
  const { stdout, code } = await run("list");
  expect(code).toBe(0);
  expect(stdout).toMatch(/^laptop +Laptop \(license: MIT\)$/m);
  expect(stdout).toContain("phone");
  expect(stdout).toContain("tablet");
});

test("add copies the items in with headers, and says what to install", async () => {
  const { stdout, stderr, code } = await run("add", "laptop", "phone", `${registry}/tablet.json`, "--no-install");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  expect(JSON.parse(readFileSync(join(project, "vectoys.json"), "utf8"))).toEqual({
    dir: "src/components/vectoys",
    registry: "https://vectoys.com/r",
    registries: {},
  });
  expect(stdout).toContain("Packages install with bun.");
  expect(stdout).toContain("Install what the items need with: bun add @vinena/vectoys @vinena/vectoys-react");

  for (const [name, component] of [["laptop", "laptop.tsx"], ["phone", "phone.tsx"], ["tablet", "tablet.tsx"]] as const) {
    const source = readFileSync(join(repo, "registry", name, "src", component), "utf8");
    const copied = readFileSync(target(name, component), "utf8");
    expect(copied).toStartWith(`// vectoys ${name}, from ${registry}/${name}.json\n// License: MIT. Credit: vectoys (https://vectoys.com)\n`);
    expect(copied).toEndWith(source);
    expect(copied).toContain('from "./geometry";');
    expect(readFileSync(target(name, "geometry.ts"), "utf8")).toStartWith(`// vectoys ${name}, from`);
  }
});

test("a second add leaves files alone unless told to replace them", async () => {
  expect((await run("add", "phone", "--no-install")).stdout).toContain("Same     src/components/vectoys/phone/phone.tsx");
  writeFileSync(target("phone", "geometry.ts"), "// changed\n");
  expect((await run("add", "phone", "--no-install")).stdout).toContain("Kept     src/components/vectoys/phone/geometry.ts (pass --overwrite to replace it)");
  expect(readFileSync(target("phone", "geometry.ts"), "utf8")).toBe("// changed\n");
  expect((await run("add", "phone", "--no-install", "--overwrite")).stdout).toContain("Wrote    src/components/vectoys/phone/geometry.ts");
  expect(readFileSync(target("phone", "geometry.ts"), "utf8")).toStartWith("// vectoys phone");
});

test("errors are plain and exit with 1", async () => {
  const missing = await run("add", "nothing-here", "--no-install");
  expect(missing.code).toBe(1);
  expect(missing.stderr).toBe(`vectoys: ${registry}/nothing-here.json answered 404, no such item.\n`);
  const scope = await run("add", "@acme/thing");
  expect(scope.stderr).toContain("No registry is set for @acme.");
});

test("one missing item stops the add before any file is written", async () => {
  mkdirSync(join(work, "empty"));
  const { stderr, code } = await run("add", "tablet", "nothing-here", "--no-install", "--cwd", join(work, "empty"));
  expect(code).toBe(1);
  expect(stderr).toContain("nothing-here.json answered 404");
  expect(existsSync(join(work, "empty/components"))).toBe(false);
  expect(existsSync(join(work, "empty/vectoys.json"))).toBe(false);
});

test("an item named to climb out of the folder is turned away", async () => {
  const files = [{ path: "x/Button.tsx", content: "export {};\n" }];
  writeFileSync(join(out, "climb.json"), JSON.stringify({ name: "..", files }));
  writeFileSync(join(out, "here.json"), JSON.stringify({ name: ".", files }));
  for (const name of ["climb", "here"]) {
    const { stderr, code } = await run("add", name, "--no-install");
    expect(code).toBe(1);
    expect(stderr).toContain("is not a registry item");
  }
  expect(existsSync(join(project, "src/components/Button.tsx"))).toBe(false);
  expect(existsSync(target("Button.tsx"))).toBe(false);
});

test("an item with dependencies that are not package names is turned away", async () => {
  const files = [{ path: "x/Button.tsx", content: "export {};\n" }];
  for (const [name, dependencies] of [["flags", ["--registry=http://evil.example", "left-pad"]], ["shell", ["x & calc"]], ["text", "left-pad"]] as const) {
    writeFileSync(join(out, `${name}.json`), JSON.stringify({ name, files, dependencies }));
    const { stderr, code } = await run("add", name, "--no-install");
    expect(code).toBe(1);
    expect(stderr).toContain("lists dependencies that are not plain npm package names");
    expect(existsSync(target(name))).toBe(false);
  }
});

// Each item in use on a page, so the typecheck below covers every one.
const USES: Record<string, { imports: string[]; jsx: string }> = {
  browser: { imports: ['import { Browser } from "./components/vectoys/browser/browser";'], jsx: '<Browser url="example.com" depth={20} offset={[4, 2]}><p>a</p></Browser>' },
  card: { imports: ['import { Card } from "./components/vectoys/card/card";'], jsx: "<Card front={<p>a</p>} back={<p>b</p>} trigger=\"hover\" />" },
  dice: { imports: ['import { Dice } from "./components/vectoys/dice/dice";'], jsx: "<Dice value={3} onRoll={(value) => value} />" },
  envelope: { imports: ['import { Envelope } from "./components/vectoys/envelope/envelope";'], jsx: "<Envelope open={0.5}><p>a</p></Envelope>" },
  floppy: { imports: ['import { Floppy } from "./components/vectoys/floppy/floppy";'], jsx: '<Floppy href="/kit.zip">kit</Floppy>' },
  gift: { imports: ['import { Gift } from "./components/vectoys/gift/gift";'], jsx: '<Gift ribbon="#fff">SAVE20</Gift>' },
  keyboard: {
    imports: ['import { Keyboard } from "./components/vectoys/keyboard/keyboard";'],
    jsx: '<Keyboard demo="hi" defaultSound={false} onSoundChange={(sound) => sound} listen={false} finish="#eee" />',
  },
  keycap: { imports: ['import { Keycap, KeycapRow } from "./components/vectoys/keycap/keycap";'], jsx: '<Keycap onPress={() => {}}>Go</Keycap><KeycapRow keys={["a", "b"]} />' },
  laptop: {
    imports: ['import { Laptop } from "./components/vectoys/laptop/laptop";', 'import { DESK } from "./components/vectoys/laptop/geometry";'],
    jsx: "<Laptop eye={DESK} closed={0.5}><p>a</p></Laptop>",
  },
  monitor: { imports: ['import { Monitor } from "./components/vectoys/monitor/monitor";'], jsx: "<Monitor tilt={10}><p>a</p></Monitor>" },
  phone: { imports: ['import { Phone } from "./components/vectoys/phone/phone";'], jsx: "<Phone yaw={30}><p>b</p></Phone>" },
  tablet: { imports: ['import { Tablet } from "./components/vectoys/tablet/tablet";'], jsx: "<Tablet><p>c</p></Tablet>" },
  watch: { imports: ['import { Watch } from "./components/vectoys/watch/watch";'], jsx: '<Watch band="#333"><p>d</p></Watch>' },
};

test("every item in the index adds, and the page uses each one", async () => {
  const names: string[] = JSON.parse(readFileSync(join(out, "index.json"), "utf8")).items.map((item: { name: string }) => item.name);
  expect(Object.keys(USES).sort()).toEqual([...names].sort());
  const { stderr, code } = await run("add", ...names, "--no-install", "--overwrite");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  for (const name of names) expect(existsSync(target(name, "geometry.ts"))).toBe(true);
});

// A tsconfig for `dir` that maps the vectoys packages and React to this repo.
function tsconfig(dir: string, options: Record<string, unknown>) {
  const types = realpathSync(join(repo, "packages/react/node_modules/@types"));
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        // The workspace package sources import each other with .ts.
        rewriteRelativeImportExtensions: true,
        types: [],
        paths: {
          "@vinena/vectoys": [join(repo, "packages/engine/src/index.ts")],
          "@vinena/vectoys-react": [join(repo, "packages/react/src/index.ts")],
          // NodeNext does not look for index.d.ts in a folder, so name the files.
          react: [join(types, "react/index.d.ts")],
          "react/*": [join(types, "react/*.d.ts")],
        },
        ...options,
      },
      include: ["src"],
    }),
  );
}

// A page in `dir` that uses every item, with relative imports ending in `extension`.
function page(dir: string, extension = "") {
  const imports = Object.values(USES).flatMap((use) => use.imports.map((line) => line.replace(/(\/[\w-]+)";$/, `$1${extension}";`)));
  writeFileSync(join(dir, "src/page.tsx"), [...imports, `export const Page = () => (<>${Object.values(USES).map((use) => use.jsx).join("")}</>);`].join("\n"));
}

function typecheck(dir: string) {
  const check = Bun.spawnSync([join(repo, "node_modules/.bin/tsc"), "-p", dir]);
  expect(check.stdout.toString() + check.stderr.toString()).toBe("");
  expect(check.exitCode).toBe(0);
}

test("the copied items typecheck against the workspace packages", () => {
  tsconfig(project, { module: "ESNext", moduleResolution: "bundler" });
  page(project);
  typecheck(project);
}, 60_000);

test("under NodeNext the copied imports get .js and typecheck", async () => {
  const node = join(work, "node");
  mkdirSync(join(node, "src"), { recursive: true });
  writeFileSync(join(node, "package.json"), JSON.stringify({ name: "node-site", private: true, type: "module", dependencies: { react: "19.0.0" } }));
  writeFileSync(join(node, "bun.lock"), "");
  tsconfig(node, { module: "NodeNext", moduleResolution: "NodeNext" });
  const names: string[] = JSON.parse(readFileSync(join(out, "index.json"), "utf8")).items.map((item: { name: string }) => item.name);
  const { stderr, code } = await runIn(node, "add", ...names, "--no-install");
  expect(stderr).toBe("");
  expect(code).toBe(0);
  expect(readFileSync(join(node, "src/components/vectoys/laptop/laptop.tsx"), "utf8")).toContain('from "./geometry.js"');
  page(node, ".js");
  typecheck(node);
}, 60_000);
