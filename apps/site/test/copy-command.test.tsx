import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setTracker } from "../src/analytics";
import { CopyPrompt } from "../src/components/copy-command";

let host: HTMLDivElement;
let root: Root;
let sent: [string, Record<string, unknown> | undefined][] = [];
const realClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

/** Gives the page a clipboard whose writes do what `write` does. */
function clipboard(write: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mock(write) } });
  return navigator.clipboard.writeText as ReturnType<typeof mock>;
}

beforeEach(() => {
  sent = [];
  setTracker({ track: (name, properties) => sent.push([name, properties]) });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<CopyPrompt prompt="Make it 3D." caption="Prompt for your agent" placement="hero" />));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  setTracker(null);
  if (realClipboard) Object.defineProperty(navigator, "clipboard", realClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

const press = async () => {
  await act(async () => host.querySelector<HTMLButtonElement>(".command-copy")?.click());
};

test("a copy sends prompt_copy with the placement", async () => {
  const write = clipboard(async () => {});
  await press();
  expect(write).toHaveBeenCalledWith("Make it 3D.");
  expect(sent).toEqual([["prompt_copy", { placement: "hero" }]]);
  expect(host.querySelector(".command-copy")?.getAttribute("data-copied")).toBe("true");
});

test("the copy button is named after the caption", () => {
  expect(host.querySelector(".command-copy")?.getAttribute("aria-label")).toBe("Copy prompt for your agent");
});

test("a copy that fails sends nothing", async () => {
  clipboard(async () => {
    throw new Error("denied");
  });
  await press();
  expect(sent).toEqual([]);
});
