import { afterAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AUTHOR, FIRST, SCHEMA, buildRegistry, checkItem, componentName, header, type RegistryIndex, type RegistryItem } from "../src";

const root = resolve(import.meta.dir, "../../..");
const out = await mkdtemp(join(tmpdir(), "vectoys-registry-"));
afterAll(() => rm(out, { recursive: true, force: true }));

test("writes an index and one shadcn registry item per device", async () => {
  await buildRegistry({ root, out, baseUrl: "https://example.test/r" });
  const index: RegistryIndex = JSON.parse(await readFile(join(out, "index.json"), "utf8"));
  // Every folder under registry/ is an item: the keyboard and the keycap first, then the rest in name order.
  const folders = (await readdir(join(root, "registry"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  expect(FIRST).toEqual(["keyboard", "keycap"]);
  expect(index.items.map((item) => item.name)).toEqual([...FIRST, ...folders.filter((name) => !FIRST.includes(name)).sort()]);
  expect(index.items.find((item) => item.name === "phone")).toMatchObject({ name: "phone", title: "Phone", type: "registry:component", license: "MIT", author: AUTHOR, credit: AUTHOR });

  const phone: RegistryItem = JSON.parse(await readFile(join(out, "phone.json"), "utf8"));
  expect(phone).toMatchObject({
    $schema: SCHEMA,
    name: "phone",
    type: "registry:component",
    dependencies: ["@vinena/vectoys", "@vinena/vectoys-react"],
    meta: { license: "MIT", source: "https://example.test/r/phone.json" },
  });
  expect(phone.files.map((file) => [file.path, file.target])).toEqual([
    ["registry/phone/src/geometry.ts", "@components/vectoys/phone/geometry.ts"],
    ["registry/phone/src/phone.tsx", "@components/vectoys/phone/phone.tsx"],
  ]);
});

test("each copied file starts with a short header over the untouched source", async () => {
  const laptop: RegistryItem = JSON.parse(await readFile(join(out, "laptop.json"), "utf8"));
  const geometry = laptop.files[0]!;
  const source = await readFile(join(root, "registry/laptop/src/geometry.ts"), "utf8");
  const lines = geometry.content.split("\n");
  expect(lines[0]).toBe("// vectoys laptop, from https://example.test/r/laptop.json");
  expect(lines[1]).toBe("// License: MIT. Credit: vectoys (https://vectoys.com)");
  expect(lines.slice(2).join("\n")).toBe(source);
});

test("headers follow the file's syntax", () => {
  expect(header("a.tsx", ["one"])).toBe("// one\n");
  expect(header("a.css", ["one", "two"])).toBe("/*\n * one\n * two\n */\n");
  expect(header("a.json", ["one"])).toBe("");
});

test("the index keeps an outside maker's name and credit", async () => {
  const repo = await mkdtemp(join(tmpdir(), "vectoys-maker-"));
  try {
    await mkdir(join(repo, "registry/ball/src"), { recursive: true });
    await writeFile(join(repo, "registry/ball/src/ball.tsx"), "export const Ball = () => null;\n");
    const item = { name: "ball", title: "Ball", description: "A ball.", files: ["src/ball.tsx"], license: "MIT", author: "Jane Doe (https://jane.example)", credit: "Jane Doe" };
    await writeFile(join(repo, "registry/ball/item.json"), JSON.stringify(item));
    const index = await buildRegistry({ root: repo, out: join(repo, "out") });
    expect(index.items).toEqual([
      { name: "ball", title: "Ball", description: "A ball.", type: "registry:component", author: "Jane Doe (https://jane.example)", license: "MIT", credit: "Jane Doe" },
    ]);
    const written: RegistryIndex = JSON.parse(await readFile(join(repo, "out/index.json"), "utf8"));
    expect(written.items).toEqual(index.items);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("author and credit, when given, must be one line of text that cannot end a comment", () => {
  const item = { name: "ball", title: "Ball", description: "A ball.", files: ["src/ball.tsx"], license: "MIT" };
  expect(checkItem({ ...item, author: "Jane (https://jane.example)", credit: "Jane" }, "item.json")).toMatchObject({ author: "Jane (https://jane.example)" });
  const author = 'item.json "author" must be one line of text like "Name (https://site)"';
  for (const bad of [42, " ", "Jane\nconsole.log(1)", "Jane\r(https://jane.example)", "Jane */ (https://jane.example)"]) {
    expect(() => checkItem({ ...item, author: bad }, "item.json")).toThrow(author);
  }
  for (const bad of [["Jane"], "", "Jane\nalert(1)", "Jane\u2028alert(1)", "Jane */ alert(1) /*"]) {
    expect(() => checkItem({ ...item, credit: bad }, "item.json")).toThrow('item.json "credit" must be one line of text');
  }
});

test("component names start with a letter", () => {
  expect(componentName("laptop-front")).toBe("LaptopFront");
  expect(componentName("3d-box")).toBe("Item3dBox");
});

test("an item's name must match its folder, so the site finds its code", async () => {
  const repo = await mkdtemp(join(tmpdir(), "vectoys-folder-"));
  try {
    await mkdir(join(repo, "registry/ball/src"), { recursive: true });
    await writeFile(join(repo, "registry/ball/src/ball.tsx"), "export const Ball = () => null;\n");
    const item = { name: "round-ball", title: "Ball", description: "A ball.", files: ["src/ball.tsx"], license: "MIT" };
    await writeFile(join(repo, "registry/ball/item.json"), JSON.stringify(item));
    await expect(buildRegistry({ root: repo, out: join(repo, "out") })).rejects.toThrow('registry/ball/item.json "name" must be "ball", the name of its folder');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
