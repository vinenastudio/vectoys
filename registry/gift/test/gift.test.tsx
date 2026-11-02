import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Gift, seen } from "../src";

const lidPath = (view: ReturnType<typeof seen>) => view.drawn.hulls.find((hull) => hull.part === "lid")!.d;

test.each([0, 0.2, 0.5, 0.8, 1])("draws %p of the way open with no NaN", (open) => {
  const view = seen(open);
  expect(view.drawn.faces.length).toBeGreaterThan(0);
  expect(JSON.stringify(view)).not.toContain("NaN");
});

test("the lid's top faces the eye all the way open, so its ribbon and bow draw over it", () => {
  for (let step = 0; step <= 40; step++) {
    const faces = seen(step / 40).drawn.faces;
    expect(faces.some((face) => face.part === "lid" && face.role === "top")).toBe(true);
    expect(faces.filter((face) => face.part.startsWith("ribbon-")).length).toBe(2);
  }
});

test("renders on the server with an accessible button and the surprise hidden", () => {
  const html = renderToString(
    <Gift label="Open your gift" finish="#3b82f6" ribbon="#ffffff">
      <p>SAVE20</p>
    </Gift>,
  );
  expect(html).toContain('<svg viewBox="0 0 100 110"');
  expect(html).toContain('aria-label="Open your gift"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain("--vectoys-finish:#3b82f6");
  expect(html).toContain("--vectoys-accent:#ffffff");
  expect(html).toContain("<p>SAVE20</p>");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("inset(0 0 100% 0)");
  expect(html).not.toContain("NaN");
});

test("an open gift renders its surprise shown and expanded", () => {
  const html = renderToString(<Gift open>SAVE20</Gift>);
  expect(html).toContain('aria-expanded="true"');
  expect(html).not.toContain("inset(0 0 100% 0)");
});

test("the surprise is hidden in the shut box, cut by the rim as it rises and out of the open one", () => {
  expect(seen(0).surprise.shown).toBe(0);
  const rising = seen(0.45).surprise.shown;
  expect(rising).toBeGreaterThan(0);
  expect(rising).toBeLessThan(1);
  expect(seen(1).surprise.shown).toBeGreaterThan(rising);
});

test("opening lifts the lid off and the bow with it, and a peek lifts it a little", () => {
  const [shut, open] = [seen(0), seen(1)];
  expect(lidPath(open)).not.toBe(lidPath(shut));
  expect(lidPath(seen(0, 1))).not.toBe(lidPath(shut));
  const knot = (view: ReturnType<typeof seen>) => Math.min(...view.drawn.hulls.find((hull) => hull.part === "knot")!.points.map(([, y]) => y));
  expect(knot(open)).toBeLessThan(knot(shut));
});

test("the lid is drawn over the box whatever its state", () => {
  for (const open of [0, 0.5, 1]) {
    const parts = seen(open).drawn.faces.map((face) => face.part);
    expect(parts.lastIndexOf("box")).toBeLessThan(parts.indexOf("lid"));
  }
});

test("className and style go on the outer box, which holds the toy and its full screen button", () => {
  const html = renderToString(<Gift className="mine" style={{ width: 200 }} />);
  expect(html).toMatch(/^(<style[^>]*>[\s\S]*?<\/style>)*<div class="vectoys-turntable mine" style="width:200px"/);
  expect(html.match(/class="[^"]*\bmine\b/g)).toHaveLength(1);
});
