import { afterEach, expect, spyOn, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { fire, mount } from "../../../packages/react/test/dom";
import { LaptopFront } from "../src";

afterEach(() => document.body.replaceChildren());

test("renders on the client with no React warnings, its content live in the glass", async () => {
  const errors = spyOn(console, "error");
  try {
    let clicks = 0;
    const { host, unmount } = await mount(
      <LaptopFront finish="black">
        <button type="button" onClick={() => (clicks += 1)}>
          live
        </button>
      </LaptopFront>,
    );
    const button = host.querySelector("button");
    expect(button?.textContent).toBe("live");
    // In the glass: the laptop's group holds the content, laid out on its screen layer.
    const group = host.querySelector('[role="group"]');
    expect(button && group?.contains(button)).toBe(true);
    const transforms: string[] = [];
    for (let at = button?.parentElement; at && at !== group; at = at.parentElement) transforms.push(at.style.transform);
    expect(transforms).toContainEqual(expect.stringMatching(/^matrix3d\(/));
    button?.click();
    expect(clicks).toBe(1);
    expect(host.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("Laptop");
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
    await unmount();
  } finally {
    errors.mockRestore();
  }
});

const pointer = (type: string, x: number) => new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, pointerType: "mouse", button: 0, bubbles: true });

test("a drag on the laptop's frame tilts it, a drag on its display does not, and the display's content still takes clicks", async () => {
  let clicks = 0;
  const { host, unmount } = await mount(
    <LaptopFront>
      <p>
        Some text <span onClick={() => (clicks += 1)}>here</span>
      </p>
    </LaptopFront>,
  );
  const body = host.querySelector<HTMLElement>(".vectoys-turntable-body")!;
  const text = host.querySelector("span")!;
  await fire(text, pointer("pointerdown", 0));
  await fire(text, pointer("pointermove", 60));
  expect(body.style.transform).toContain("rotateY(0deg)");
  await fire(text, pointer("pointerup", 60));
  await fire(text, new MouseEvent("click", { bubbles: true }));
  expect(clicks).toBe(1);
  const frame = host.querySelector("svg path")!;
  await fire(frame, pointer("pointerdown", 0));
  await fire(frame, pointer("pointermove", 60));
  expect(body.style.transform).not.toContain("rotateY(0deg)");
  await fire(frame, pointer("pointerup", 60));
  await unmount();
});

test("with dragging and full screen off the laptop has no tab stop of its own and no full screen button", () => {
  const html = renderToString(<LaptopFront draggable={false} fullscreen={false} />);
  expect(html).not.toContain('tabindex="0"');
  expect(html).not.toContain("Full screen");
  expect(renderToString(<LaptopFront />)).toContain('aria-label="Full screen Laptop"');
});
