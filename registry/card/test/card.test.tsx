import { expect, test } from "bun:test";
import { screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { Card, FACE, seen, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };
const facing = (view: ReturnType<typeof seen>, side: "front" | "back") => screenQuad(view.camera, view[side], FACE, ELEMENT).facing;

test.each<Turn>([{}, { flip: 180 }, { flip: 90 }, { flip: 45, yaw: 9, pitch: -9 }])("renders on the server, turned %p", (turn) => {
  const view = seen(turn);
  expect(view.drawn.faces.length).toBeGreaterThan(0);
  expect(JSON.stringify(view.drawn)).not.toContain("NaN");
});

test("renders an accessible button, both faces and no NaN", () => {
  const html = renderToString(<Card front={<p>front</p>} back={<p>back</p>} label="Show the price" />);
  expect(html).toContain('<svg viewBox="0 0 100 120"');
  expect(html).toContain('aria-label="Show the price"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain("<p>front</p>");
  expect(html).toContain("<p>back</p>");
  expect(html).not.toContain("NaN");
});

test("the front shows at rest and the back once flipped", () => {
  const rest = seen();
  const over = seen({ flip: 180 });
  expect(facing(rest, "front")).toBe(true);
  expect(facing(rest, "back")).toBe(false);
  expect(facing(over, "front")).toBe(false);
  expect(facing(over, "back")).toBe(true);
  expect(over.drawn.faces.map((face) => face.role)).toContain("bottom");
});

test("the back reads the right way round once flipped", () => {
  const view = seen({ flip: 180 });
  const [topLeft, topRight, , bottomLeft] = screenQuad(view.camera, view.back, FACE, ELEMENT).corners;
  expect(topRight[0]).toBeGreaterThan(topLeft[0]);
  expect(bottomLeft[1]).toBeGreaterThan(topLeft[1]);
});

test("a flipped card renders its back facing and pressed", () => {
  const html = renderToString(<Card flipped front="front" back="back" />);
  expect(html).toContain('aria-pressed="true"');
  expect(html.indexOf("visibility:hidden")).toBeLessThan(html.indexOf("visibility:visible"));
});

test("flipping and tilting change the drawing", () => {
  const rest = seen().drawn.faces.map((face) => face.d).join();
  expect(seen({ flip: 90 }).drawn.faces.map((face) => face.d).join()).not.toBe(rest);
  expect(seen({ yaw: 9 }).drawn.faces.map((face) => face.d).join()).not.toBe(rest);
});

test("a face seen straight on keeps the page's color, unshaded", () => {
  const front = seen().drawn.faces.find((face) => face.role === "top")!;
  expect(front.shade).toBeGreaterThan(0.875);
  expect(front.shade).toBeLessThanOrEqual(0.95);
});

test("both faces clip live HTML to their rounded corners", () => {
  const html = renderToString(<Card front={<p>front</p>} back={<p>back</p>} />);
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(2);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
});

test("with dragging and full screen off there is no tab stop and no full screen button", () => {
  const on = renderToString(<Card front="front" back="back" />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Flip card"');
  const off = renderToString(<Card front="front" back="back" draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("Full screen");
  expect(off.match(/<button/g)).toHaveLength(1);
});
