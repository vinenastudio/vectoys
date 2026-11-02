import { expect, test } from "bun:test";
import { rotateX } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { Dice, ROLL_MS, VALUES, WOBBLE_MS, resting, roll, rollAt, seen, upFace } from "../src";

const pipsShown = (view: ReturnType<typeof seen>, value: number) =>
  new Set(view.drawn.faces.filter((face) => face.part.startsWith(`pip-${value}-`)).map((face) => face.part)).size;

test("renders on the server with an accessible button and no NaN", () => {
  const html = renderToString(<Dice label="Roll for a discount" finish="#f0d9b5" />);
  expect(html).toContain('<svg viewBox="0 0 100 100"');
  expect(html).toContain('aria-label="Roll for a discount"');
  expect(html).toContain("<button");
  expect(html).toContain("--vectoys-finish:#f0d9b5");
  expect(html).toContain("Showing 5");
  expect(html).not.toContain("NaN");
});

test.each([...VALUES])("resting on %i shows that face on top with all its pips", (value) => {
  expect(upFace(resting(value))).toBe(value);
  expect(pipsShown(seen(resting(value)), value)).toBe(value);
  expect(renderToString(<Dice value={value} />)).toContain(`Showing ${value}`);
});

test("faces that face away draw no pips", () => {
  expect(pipsShown(seen(resting(1)), 6)).toBe(0);
});

test.each([...VALUES])("a roll lands on %i whatever it starts from", (value) => {
  for (const heading of [0, 70, 215]) {
    const path = roll(rotateX(37), value, heading);
    const end = rollAt(path, ROLL_MS + WOBBLE_MS);
    expect(end.done).toBe(true);
    expect(end.hop).toBe(0);
    expect(upFace(end.rotation)).toBe(value);
  }
});

test("a roll starts where the die was, hops, and wobbles before it settles", () => {
  const from = resting(2);
  const path = roll(from, 6, 40);
  rollAt(path, 0).rotation.forEach((value, index) => expect(value).toBeCloseTo(from[index]!, 9));
  expect(rollAt(path, ROLL_MS * 0.3).hop).toBeGreaterThan(0);
  const wobble = rollAt(path, ROLL_MS + 60);
  expect(wobble.done).toBe(false);
  expect(wobble.rotation).not.toEqual(resting(6));
});

test("rolling changes the drawing, and the shadow fades as the die hops", () => {
  const rest = seen(resting(3));
  const air = seen(rollAt(roll(resting(3), 4, 0), ROLL_MS * 0.3).rotation, 20);
  expect(air.drawn.faces.map((face) => face.d).join()).not.toBe(rest.drawn.faces.map((face) => face.d).join());
  expect(air.shadow.strength).toBeLessThan(rest.shadow.strength);
  expect(JSON.stringify(air)).not.toContain("NaN");
});

test("className and style go on the outer box, which holds the toy and its full screen button", () => {
  const html = renderToString(<Dice className="mine" style={{ width: 200 }} />);
  expect(html).toMatch(/^(<style[^>]*>[\s\S]*?<\/style>)*<div class="vectoys-turntable mine" style="width:200px"/);
  expect(html.match(/class="[^"]*\bmine\b/g)).toHaveLength(1);
});
