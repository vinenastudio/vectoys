import { afterEach, expect, spyOn, test } from "bun:test";
import { mount } from "../../../packages/react/test/dom";
import { FRONT, Laptop } from "../src";

afterEach(() => document.body.replaceChildren());

test("FRONT renders on the client with no React warnings", async () => {
  const errors = spyOn(console, "error");
  try {
    const { host } = await mount(
      <Laptop eye={FRONT}>
        <p>live</p>
      </Laptop>,
    );
    expect(host.querySelector("p")?.textContent).toBe("live");
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
  } finally {
    errors.mockRestore();
  }
});
