import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const site = resolve(import.meta.dir, "..");
const html = readFileSync(resolve(site, "index.html"), "utf8");

test("the home head has a 50 to 60 character title, a 120 to 160 character description and a canonical", () => {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
  expect(title.length).toBeGreaterThanOrEqual(50);
  expect(title.length).toBeLessThanOrEqual(60);
  expect(description.length).toBeGreaterThanOrEqual(120);
  expect(description.length).toBeLessThanOrEqual(160);
  expect(html).toContain('<link rel="canonical" href="https://vectoys.com/" />');
  expect(html).toContain(`<meta property="og:title" content="${title}" />`);
  expect(html).toContain(`<meta name="twitter:title" content="${title}" />`);
});

test("og:image comes before its size, type and alt, with no share tag twice", () => {
  const keys = [...html.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)"/g)].map((match) => match[1]);
  expect(new Set(keys).size).toBe(keys.length);
  const image = keys.indexOf("og:image");
  expect(image).toBeGreaterThan(-1);
  for (const key of ["og:image:width", "og:image:height", "og:image:type", "og:image:alt"]) expect(keys.indexOf(key)).toBeGreaterThan(image);
  expect(html).toContain('<meta property="og:image:type" content="image/png" />');
});

test("the JSON-LD graph names the publisher, the website and the source code", () => {
  const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  const graph: { "@type": string; [key: string]: unknown }[] = JSON.parse(json)["@graph"];
  expect(graph.map((node) => node["@type"])).toEqual(["Organization", "WebSite", "SoftwareSourceCode"]);
  expect(graph[0]).toMatchObject({ name: "Vinena Studio", url: "https://vinena.studio" });
  expect(graph[2]).toMatchObject({ codeRepository: "https://github.com/vinenastudio/vectoys", programmingLanguage: "TypeScript" });
});

test("robots.txt points to a sitemap of every public page", () => {
  expect(readFileSync(resolve(site, "public/robots.txt"), "utf8")).toContain("Sitemap: https://vectoys.com/sitemap.xml");
  const sitemap = readFileSync(resolve(site, "public/sitemap.xml"), "utf8");
  for (const url of ["https://vectoys.com/", "https://vectoys.com/toys", "https://vectoys.com/submit"]) expect(sitemap).toContain(`<loc>${url}</loc>`);
});
