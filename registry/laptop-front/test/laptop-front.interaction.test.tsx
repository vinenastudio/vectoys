import { afterEach, expect, spyOn, test } from "bun:test";
import { mount } from "../../../packages/react/test/dom";
import { LaptopFront } from "../src";

afterEach(() => document.body.replaceChildren());

test("renders on the client with no React warnings, its content live in the glass", async () => {
  const errors = spyOn(console, "error");
  try {
    let clicks = 0;
    const { host } = await mount(
      <LaptopFront finish="black">
        <button type="button" onClick={() => (clicks += 1)}>
          live
        </button>
      </LaptopFront>,
    );
    const button = host.querySelector("button");
    expect(button?.textContent).toBe("live");
    button?.click();
    expect(clicks).toBe(1);
    expect(host.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("Laptop");
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
