import { expect, test } from "bun:test";
import { fixed, screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DESK, FRONT, GLASS, LAPTOP_BOX, Laptop, PHONE, PITCH, WIDTH, YAW } from "../src";

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

/** Every point of some path data, as (x, y). */
const points = (d: string) => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match): readonly [number, number] => [Number(match[1]), Number(match[2])]);

test.each([DESK, PHONE])("the fixed box holds the whole laptop in every pose, with it in the middle", (eye) => {
  const box = LAPTOP_BOX[eye.id === "desk" ? "desk" : "phone"];
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let yaw = -YAW; yaw <= YAW; yaw += 2.5) {
    for (let pitch = PITCH[0]; pitch <= PITCH[1]; pitch += 2.5) {
      const view = eye.at({ yaw, pitch }, true);
      expect([view.camera.width, view.camera.height]).toEqual([box.width, box.height]);
      for (let lid = 0; lid <= 1; lid += 0.05) {
        const art = view.lidArt(1 - lid);
        for (const [x, y] of [...points(view.DECK.hull), ...points(art.hull), ...points(view.DECK.ground)]) {
          [left, right, top, bottom] = [Math.min(left, x), Math.max(right, x), Math.min(top, y), Math.max(bottom, y)];
        }
      }
    }
  }
  expect(left).toBeGreaterThan(0);
  expect(top).toBeGreaterThan(0);
  expect(right).toBeLessThan(box.width);
  expect(bottom).toBeLessThan(box.height);
  expect(Math.abs(left - (box.width - right))).toBeLessThan(0.5);
  expect(Math.abs(top - (box.height - bottom))).toBeLessThan(3);
});

test("turning draws in the fixed box, and a turned laptop's markup is the same twice", () => {
  const render = () =>
    renderToString(
      <Laptop eye={DESK} turning lid={0.6} yaw={-20} pitch={24}>
        <p>live</p>
      </Laptop>,
    );
  expect(render()).toContain(`<svg viewBox="0 0 ${LAPTOP_BOX.desk.width} ${LAPTOP_BOX.desk.height}"`);
  expect(render()).toBe(render());
  expect(render()).not.toContain("NaN");
});

test("lid is how far open, closed is still read, and lid wins over it", () => {
  const render = (props: { lid?: number; closed?: number }) => renderToString(<Laptop eye={DESK} yaw={0} {...props} />);
  expect(render({ lid: 0.3 })).toBe(render({ closed: 0.7 }));
  expect(render({ lid: 0.3, closed: 0 })).toBe(render({ lid: 0.3 }));
  expect(render({ lid: 2 })).toBe(render({ lid: 1 }));
});

test("the eye's own pitch and no turn draw the laptop as it always was", () => {
  for (const eye of [DESK, PHONE]) {
    expect(eye.at({ yaw: 0, pitch: eye.pitch }).DECK).toBe(eye.DECK);
    expect(eye.at({ yaw: 0, pitch: eye.pitch + 1 }).DECK).not.toEqual(eye.DECK);
  }
  expect([DESK.pitch, PHONE.pitch]).toEqual([15, 12]);
});

test.each([-35, -20, 20, 35])("turned %p degrees, the glass lies inside the lid's face", (yaw) => {
  const view = DESK.at({ yaw, pitch: 15 }, true);
  const quad = screenQuad(view.camera, view.lidWorld(0), GLASS, { width: 1, height: 1 });
  expect(quad.facing).toBe(true);
  const face = points(view.lidArt(0).face);
  const [xs, ys] = [face.map(([x]) => x), face.map(([, y]) => y)];
  for (const [x, y] of quad.corners) {
    expect(x).toBeGreaterThan(Math.min(...xs));
    expect(x).toBeLessThan(Math.max(...xs));
    expect(y).toBeGreaterThan(Math.min(...ys));
    expect(y).toBeLessThan(Math.max(...ys));
  }
});

test("an eye's id keys its box, which the type checker knows", () => {
  const boxes: { width: number; height: number }[] = [DESK, PHONE].map((eye) => LAPTOP_BOX[eye.id]);
  expect(boxes).toEqual([LAPTOP_BOX.desk, LAPTOP_BOX.phone]);
  const desk: "desk" = DESK.id;
  expect(desk).toBe("desk");
  // @ts-expect-error FRONT does not turn, so it has no box.
  expect(LAPTOP_BOX[FRONT.id]).toBeUndefined();
});
