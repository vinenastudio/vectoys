import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Header } from "../src/components/header";
import { Submit } from "../src/sections/submit";

// The gallery's previews come from Vite's import.meta.glob, which bun has not got.
mock.module("../src/sources", () => ({ SOURCES: {} }));
const { pageFor } = await import("../src/pages");
const { Toys } = await import("../src/sections/toys");
const { PROMPT } = await import("../src/sections/hero");

const roots: Root[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  document.body.innerHTML = "";
});

/** Draws `node` into the page and returns its host. */
function draw(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(node));
  return host;
}

const linksTo = (host: HTMLElement, href: string) => [...host.querySelectorAll<HTMLAnchorElement>("a")].filter((link) => link.getAttribute("href") === href);

describe("pageFor", () => {
  test("maps /submit, with or without a trailing slash, to the submit page", () => {
    expect(pageFor("/submit")).toBe("submit");
    expect(pageFor("/submit/")).toBe("submit");
    expect(pageFor("/toys")).toBe("toys");
    expect(pageFor("/")).toBe("home");
  });
});

describe("Submit", () => {
  test("leads with the agent prompt and its commands, then the steps by hand, and links to CONTRIBUTING", () => {
    const host = draw(<Submit />);
    expect(host.querySelector("h1")?.textContent).toBe("Submit a toy");
    expect([...host.querySelectorAll("h2")].map((heading) => heading.textContent)).toEqual(["Let your agent do it", "By hand", "What makes a good toy", "What happens next"]);
    const [agent] = host.querySelectorAll(".submit-part");
    const expected = [
      "npx @vinena/vectoys-cli create spinning-top",
      "cd spinning-top && npm install",
      "npx @vinena/vectoys-cli check .",
      "npx @vinena/vectoys-cli preview . --open",
      "npx @vinena/vectoys-cli submit .",
    ];
    expect(agent?.querySelector(".prompt p")?.textContent).toBe("Read https://vectoys.com/submit-prompt.txt and follow it to make and submit a toy: a spinning top.");
    expect(linksTo(agent as HTMLElement, "/submit-prompt.txt")[0]?.textContent).toBe("Read the full prompt");
    const full = readFileSync(resolve(import.meta.dir, "../public/submit-prompt.txt"), "utf8");
    let from = 0;
    for (const command of ["npx @vinena/vectoys-cli skill", ...expected.map((command) => command.replaceAll("spinning-top", "<name>"))]) {
      const at = full.indexOf(command, from);
      expect(at).toBeGreaterThanOrEqual(from);
      from = at + command.length;
    }
    const commands = (part: Element | undefined) => [...(part?.querySelectorAll(".command code") ?? [])].map((code) => code.textContent?.replace(/^\$\s*/, ""));
    expect(commands(agent)).toEqual(expected);
    expect(commands(host.querySelectorAll(".submit-part")[1])).toEqual(["npx @vinena/vectoys-cli create spinning-top", "npx @vinena/vectoys-cli check .", "npx @vinena/vectoys-cli submit ."]);
    expect(host.querySelectorAll(".prompt")).toHaveLength(1);
    expect(linksTo(host, "https://github.com/vinenastudio/vectoys/blob/main/CONTRIBUTING.md")).toHaveLength(1);
    expect(host.textContent).toContain("npx @vinena/vectoys-cli add spinning-top");
  });
});

describe("Submit a toy links", () => {
  test("the header links to /submit by the name Submit a toy, marked current only on that page", () => {
    const home = draw(<Header page="home" />);
    const [link] = linksTo(home, "/submit");
    expect(link?.textContent).toBe("Submit a toy");
    expect(link?.hasAttribute("aria-current")).toBe(false);
    expect(link?.dataset).toMatchObject({ track: "submit_click", placement: "header" });

    const submit = draw(<Header page="submit" />);
    expect(linksTo(submit, "/submit")[0]?.getAttribute("aria-current")).toBe("page");
  });

  test("the gallery links to /submit", () => {
    const host = draw(<Toys index={{ name: "vectoys", homepage: "https://vectoys.com", items: [] }} />);
    const [link] = linksTo(host, "/submit");
    expect(link?.textContent).toBe("Submit a toy");
    expect(link?.dataset).toMatchObject({ track: "submit_click", placement: "toys" });
  });

  test("the gallery leads with the hero's agent prompt and the link to its full text", () => {
    const host = draw(<Toys index={{ name: "vectoys", homepage: "https://vectoys.com", items: [] }} />);
    expect(host.querySelector(".toys-intro .prompt p")?.textContent).toBe(PROMPT);
    expect(linksTo(host, "/prompt.txt")[0]?.textContent).toBe("Read the full prompt");
  });
});
