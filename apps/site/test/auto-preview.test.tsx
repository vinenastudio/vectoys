import { afterEach, expect, spyOn, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { autoPreview, pickPreview, type Loader } from "../src/auto-preview";

const Demo = () => <p>demo</p>;
const Ball = () => <p>ball</p>;
const Other = () => <p>other</p>;

test("a card draws the item's Demo, else its main component, else its default export", () => {
  expect(pickPreview({ Demo, Ball, default: Other }, "ball")).toBe(Demo);
  expect(pickPreview({ TestBall: Ball, default: Other, size: 3 }, "test-ball")).toBe(Ball);
  expect(pickPreview({ default: Other }, "ball")).toBe(Other);
  expect(pickPreview({ Item3dBox: Ball }, "3d-box")).toBe(Ball);
  expect(pickPreview({ Demo: "not a component", size: 3 }, "ball")).toBeNull();
});

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

async function draw(name: string, load: Loader) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const Preview = autoPreview(name, load);
  await act(async () => root?.render(<Preview />));
  return host;
}

test("draws the item from its module, in the card's frame", async () => {
  const host = await draw("drawn", async () => ({ Demo }));
  expect(host.innerHTML).toBe('<div class="preview-toy"><p>demo</p></div>');
});

test("a module with nothing to draw shows the placeholder", async () => {
  const host = await draw("empty", async () => ({ size: 3 }));
  expect(host.textContent).toBe("Preview on its way");
});

test("an item that fails to load or draw shows the placeholder, not an error", async () => {
  const quiet = spyOn(console, "error").mockImplementation(() => {});
  try {
    const failed = await draw("unloadable", () => Promise.reject(new Error("no module")));
    expect(failed.textContent).toBe("Preview on its way");
    act(() => root?.unmount());
    const Broken = () => {
      throw new Error("broken toy");
    };
    const broken = await draw("broken", async () => ({ Demo: Broken }));
    expect(broken.textContent).toBe("Preview on its way");
  } finally {
    quiet.mockRestore();
  }
});

test("shows the placeholder while the item loads", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const Preview = autoPreview("slow", () => new Promise(() => {}));
  await act(async () => root?.render(<Preview />));
  expect(host.textContent).toBe("Preview on its way");
});

test("after a failed load, the next draw tries the import again", async () => {
  const quiet = spyOn(console, "error").mockImplementation(() => {});
  try {
    let tries = 0;
    const load: Loader = async () => {
      tries += 1;
      if (tries === 1) throw new Error("offline");
      return { Demo };
    };
    const failed = await draw("flaky", load);
    expect(failed.textContent).toBe("Preview on its way");
    act(() => root?.unmount());
    const host = await draw("flaky", load);
    expect(tries).toBe(2);
    expect(host.innerHTML).toBe('<div class="preview-toy"><p>demo</p></div>');
  } finally {
    quiet.mockRestore();
  }
});
