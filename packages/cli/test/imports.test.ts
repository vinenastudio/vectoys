import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importExtension, withExtensions } from "../src/imports";

const work = mkdtempSync(join(tmpdir(), "vectoys-imports-"));

afterAll(() => rmSync(work, { recursive: true, force: true }));

function project(name: string, files: Record<string, string>): string {
  const root = join(work, name);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const files = [
  { from: "a/geometry.ts", to: "geometry.ts", content: "export const seen = 1;\n" },
  { from: "a/parts/index.tsx", to: "parts/index.tsx", content: 'export * from "../geometry";\n' },
  {
    from: "a/phone.tsx",
    to: "phone.tsx",
    content: [
      'import { seen } from "./geometry";',
      "import type { Parts } from './parts';",
      'import "./style.css";',
      'import { Phone } from "@vinena/vectoys-react";',
      'import { done } from "./geometry.ts";',
      'const lazy = import("./parts/index");',
      'export { other } from "./missing";',
      "",
    ].join("\n"),
  },
];

test("nodenext projects get .js on relative imports of copied files", () => {
  const root = project("nodenext", {
    "tsconfig.base.json": '{ "compilerOptions": { "module": "NodeNext", }, }',
    "apps/web/tsconfig.json": '// app\n{ "extends": "../../tsconfig.base", /* jsx */ "compilerOptions": { "jsx": "react-jsx" } }',
  });
  const extension = importExtension(join(root, "apps/web/src"));
  expect(extension).toBe("js");
  const [geometry, parts, phone] = withExtensions(files, extension);
  expect(geometry!.content).toBe(files[0]!.content);
  expect(parts!.content).toBe('export * from "../geometry.js";\n');
  expect(phone!.content).toBe(
    [
      'import { seen } from "./geometry.js";',
      "import type { Parts } from './parts/index.js';",
      'import "./style.css";',
      'import { Phone } from "@vinena/vectoys-react";',
      'import { done } from "./geometry.ts";',
      'const lazy = import("./parts/index.js");',
      'export { other } from "./missing";',
      "",
    ].join("\n"),
  );
});

test("allowImportingTsExtensions keeps the files' own extensions", () => {
  const root = project("ts", { "tsconfig.json": '{ "compilerOptions": { "moduleResolution": "node16", "allowImportingTsExtensions": true } }' });
  const extension = importExtension(root);
  expect(extension).toBe("ts");
  expect(withExtensions(files, extension)[2]!.content).toStartWith("import { seen } from \"./geometry.ts\";\nimport type { Parts } from './parts/index.tsx';");
});

test("bundler and esnext projects are left alone", () => {
  const bundler = project("bundler", { "tsconfig.json": '{ "compilerOptions": { "module": "NodeNext", "moduleResolution": "Bundler" } }' });
  expect(importExtension(bundler)).toBeUndefined();
  expect(importExtension(project("esnext", { "tsconfig.json": '{ "compilerOptions": { "module": "ESNext" } }' }))).toBeUndefined();
  expect(withExtensions(files, undefined)).toBe(files);
});

test("configs extended from packages count, by their path in the package, its tsconfig field or its tsconfig.json", () => {
  const nodenext = '{ "compilerOptions": { "module": "nodenext" } }';
  const byPath = project("package-path", {
    "node_modules/@tsconfig/node20/tsconfig.json": nodenext,
    "apps/web/tsconfig.json": '{ "extends": "@tsconfig/node20/tsconfig.json" }',
  });
  expect(importExtension(join(byPath, "apps/web"))).toBe("js");
  const byField = project("package-field", {
    "node_modules/@acme/config/package.json": '{ "name": "@acme/config", "tsconfig": "base.json" }',
    "node_modules/@acme/config/base.json": '{ "compilerOptions": { "moduleResolution": "node16", "allowImportingTsExtensions": true } }',
    "tsconfig.json": '{ "extends": "@acme/config" }',
  });
  expect(importExtension(byField)).toBe("ts");
  const byDefault = project("package-default", {
    "node_modules/shared-config/tsconfig.json": nodenext,
    "tsconfig.json": '{ "extends": ["shared-config"] }',
  });
  expect(importExtension(byDefault)).toBe("js");
  expect(importExtension(project("package-missing", { "tsconfig.json": '{ "extends": "@tsconfig/none" }' }))).toBeUndefined();
});

test("a config reached through two parents counts in each, and a cycle ends", () => {
  // The later parent's own base, nodenext, wins over the earlier parent's bundler.
  const root = project("diamond", {
    "base.json": '{ "compilerOptions": { "module": "nodenext", "moduleResolution": "nodenext" } }',
    "bundler.json": '{ "extends": "./base.json", "compilerOptions": { "moduleResolution": "bundler" } }',
    "node.json": '{ "extends": "./base" }',
    "tsconfig.json": '{ "extends": ["./bundler.json", "./node.json"] }',
  });
  expect(importExtension(root)).toBe("js");
  const cycle = project("cycle", {
    "a.json": '{ "extends": "./tsconfig.json", "compilerOptions": { "module": "nodenext" } }',
    "tsconfig.json": '{ "extends": "./a.json" }',
  });
  expect(importExtension(cycle)).toBe("js");
});
