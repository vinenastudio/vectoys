import { expect, test } from "bun:test";
import { fixed, screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DESK, FRONT, GLASS, Laptop, PHONE, WIDTH } from "../src";

test.each([
  [DESK, "0 0 100 70"],
  [PHONE, "0 0 100 59"],
  [FRONT, "0 0 80.124 48.3314"],
] as const)("renders on the server with the eye's viewBox", (eye, viewBox) => {
  for (const closed of [0, 0.5, 1]) {
    const html = renderToString(
      <Laptop eye={eye} closed={closed}>
        <p>live</p>
      </Laptop>,
    );
    expect(html).toContain(`<svg viewBox="${viewBox}"`);
    expect(html).toContain("<p>live</p>");
    expect(html).not.toContain("NaN");
  }
});

// Where the Agent Caffeine hero measured the open display's glass by hand.
test.each([DESK, PHONE])("the open lid's glass lies where the hero put it", (eye) => {
  const quad = screenQuad(eye.camera, eye.lidWorld(0), GLASS, { width: 1, height: 1 });
  const [[left, top], , [right, bottom]] = quad.corners;
  expect(quad.facing).toBe(true);
  expect(left).toBeCloseTo(23.07, 2);
  expect(top).toBeCloseTo(6.21, 2);
  expect(right - left).toBeCloseTo(53.86, 2);
  expect(bottom - top).toBeCloseTo(35, 0);
});

test.each([DESK, PHONE])("the shut lid hides the glass", (eye) => {
  expect(screenQuad(eye.camera, eye.lidWorld(1), GLASS, { width: 1, height: 1 }).facing).toBe(false);
});

test("seen from the front, the lid is always open", () => {
  const render = (closed: number) => renderToString(<Laptop eye={FRONT} closed={closed} />);
  expect(render(1)).toBe(render(0));
  expect(render(1)).not.toContain("visibility:hidden");
});

test("the speaker holes are clipped to the deck top", () => {
  const html = renderToString(<Laptop eye={DESK} />);
  const clip = html.match(/<clipPath id="([^"]+-deck)">/)?.[1];
  expect(clip).toBeDefined();
  expect(html).toContain(`<g clip-path="url(#${clip})"><path d=`);
  expect(html).toMatch(/clip-path="url\(#[^)]+-deck\)"><path[^>]*vectoys-laptop-holes-0/);
});

test("seen from the front, the server draws the laptop the same twice", () => {
  const render = () =>
    renderToString(
      <Laptop eye={FRONT}>
        <p>live</p>
      </Laptop>,
    );
  expect(render()).toBe(render());
  expect(render()).not.toContain("NaN");
});

test("seen from the front, the display is a plain rectangle where product renders put it", () => {
  const quad = screenQuad(FRONT.camera, FRONT.pose, FRONT.glass, { width: FRONT.glass.width, height: FRONT.glass.height });
  const [topLeft, topRight, bottomRight, bottomLeft] = quad.corners;
  expect(quad.facing).toBe(true);
  expect(topRight[1]).toBeCloseTo(topLeft[1], 6);
  expect(bottomLeft[1]).toBeCloseTo(bottomRight[1], 6);
  expect(bottomRight[0]).toBeCloseTo(topRight[0], 6);
  expect(bottomLeft[0]).toBeCloseTo(topLeft[0], 6);
  const [width, height] = [topRight[0] - topLeft[0], bottomRight[1] - topLeft[1]];
  expect(Math.abs(width / height - 1.54)).toBeLessThan(0.005);
  // In hundredths of the lid's width, which starts 10.7 in from the base's end.
  const lid = (value: number) => (value / WIDTH) * 100;
  expect(lid(topLeft[0]) - 10.7).toBeCloseTo(1.75, 2);
  expect(lid(topLeft[1])).toBeCloseTo(1.75, 2);
  expect(lid(width)).toBeCloseTo(96.5, 2);
  expect(lid(height)).toBeCloseTo(62.67, 2);
  expect(lid(FRONT.camera.width)).toBeCloseTo(121.4, 2);
  // A scale and a move, with nothing in the matrix's perspective or skew terms.
  const columns = (quad.matrix ?? "").slice("matrix3d(".length, -1).split(",").map(Number);
  expect(columns).toHaveLength(16);
  for (const at of [1, 2, 3, 4, 6, 7]) expect(columns[at]).toBeCloseTo(0, 6);
});

test.each([DESK, FRONT])("the glass clips live HTML to its rounded top corners", (eye) => {
  const html = renderToString(
    <Laptop eye={eye}>
      <p>live</p>
    </Laptop>,
  );
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
  if (eye === FRONT) {
    const across = `${fixed((FRONT.round / FRONT.glass.width) * 100)}%`;
    expect(styles[0]).toContain(`border-radius:${across} ${across} 0 0 /`);
    expect(html).toMatch(/<svg viewBox="[^"]*" preserveAspectRatio="none" aria-hidden="true" style="[^"]*pointer-events:none/);
  }
});
