import { expect, test } from "bun:test";
import { fixed, screenQuad, scrub } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DESK, FRONT, GLASS, KICKFLIP, LAPTOP_BOX, Laptop, PHONE, PITCH, WIDTH, YAW } from "../src";

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

test("a free laptop renders on the server the same twice, from any side, with no NaN", () => {
  for (const pose of [{ flat: 1 }, { lid: 0, roll: 170, yaw: 80, y: 0.5, scale: 1.1, flat: 0.4 }, { lid: 0.5, pitch: -40, yaw: 200 }]) {
    const render = () =>
      renderToString(
        <Laptop eye={DESK} free turning {...pose}>
          <p>live</p>
        </Laptop>,
      );
    expect(render()).toBe(render());
    expect(render()).toContain(`<svg viewBox="0 0 ${LAPTOP_BOX.desk.width} ${LAPTOP_BOX.desk.height}"`);
    expect(render()).not.toMatch(/NaN|Infinity/);
  }
});

/** The bounds of some path data, as (left, top, right, bottom). */
const bounds = (d: string) => {
  const all = points(d);
  return [Math.min(...all.map(([x]) => x)), Math.min(...all.map(([, y]) => y)), Math.max(...all.map(([x]) => x)), Math.max(...all.map(([, y]) => y))];
};

test.each([DESK, PHONE])("at flat 1, open and square on, the lid, the base and the glass stand where FRONT draws them across the eye's scene", (eye) => {
  const view = eye.trick({ lid: 1, yaw: 0, pitch: eye.pitch, flat: 1, x: 0, y: 0, scale: 1, roll: 0 });
  const scale = 100 / FRONT.camera.width;
  // In FRONT's scene: the lid from 10.7 to 110.7 hundredths of its width across, the base under it over the whole scene.
  const lid = (hundredths: number) => (hundredths * WIDTH * scale) / 100;
  const expected = { lid: [lid(10.7), 0, lid(110.7)], base: [0, lid(100 / 1.465), 100, lid(100 / 1.465 + 4.37)] };
  bounds(view.d["lid.face"] ?? "").slice(0, 3).forEach((value, index) => expect(value).toBeCloseTo(expected.lid[index] ?? 0, 1));
  bounds(view.d["base.hull"] ?? "").forEach((value, index) => expect(value).toBeCloseTo(expected.base[index] ?? 0, 1));
  const quad = screenQuad(view.camera, view.glass, GLASS, { width: 1, height: 1 });
  const front = screenQuad(FRONT.camera, FRONT.pose, FRONT.glass, { width: 1, height: 1 });
  quad.corners.forEach(([x, y], index) => {
    expect(x).toBeCloseTo((front.corners[index]?.[0] ?? 0) * scale, 2);
    expect(y).toBeCloseTo((front.corners[index]?.[1] ?? 0) * scale, 2);
  });
  // Level with the deck, the eye sees neither it nor the underside.
  expect(view.d["base.top"]).toBe("");
  expect(view.d["base.under"]).toBe("");
});

test("from flat 1 to 0 the drawing moves a little for a little flat, and at 0 the camera is the eye's own", () => {
  const at = (flat: number) => DESK.trick({ lid: 1, yaw: 0, pitch: 15, flat, x: 0, y: 0, scale: 1, roll: 0 });
  for (let flat = 0; flat < 1; flat += 0.05) {
    const [a, b] = [bounds(at(flat).d["base.hull"] ?? ""), bounds(at(flat + 0.05).d["base.hull"] ?? "")];
    a.forEach((value, index) => expect(Math.abs(value - (b[index] ?? 0))).toBeLessThan(4));
  }
  const { camera } = at(0);
  for (const key of ["perspective", "back", "originX", "originY", "anchorX", "anchorY", "pitch"] as const) expect(camera[key]).toBeCloseTo(DESK.camera[key], 6);
});

test("the kickflip shuts the lid straight on, flips and turns once round, lands on the ground in the eye's own look and opens", () => {
  const first = KICKFLIP[0];
  const last = KICKFLIP[KICKFLIP.length - 1];
  expect(first).toMatchObject({ at: 0, lid: 1, flat: 1, roll: 0, yaw: 0, scale: 1 });
  expect(last).toMatchObject({ at: 1, lid: 1, flat: 0, roll: 360, yaw: 360, y: 0, scale: 1 });
  const at = (t: number) => scrub(t, KICKFLIP);
  expect(at(0.12).lid).toBe(0);
  expect(at(0.12).flat).toBe(1);
  // Coming down, the eye rises a little, so the shut slab shows its top before the pop.
  expect(at(0.3).flat).toBeLessThan(0.8);
  expect(at(0.3).flat).toBeGreaterThan(0.5);
  // It crouches before the pop, drawing its front back, and is high in the air at the top of the flip.
  expect(at(0.36).y).toBeLessThan(0);
  expect(at(0.37).roll).toBeLessThan(0);
  expect(at(0.5).y).toBeGreaterThan(0.45);
  expect(at(0.5).scale).toBeGreaterThan(1);
  // Its landing bounces up a little and never goes through the ground after.
  const landing = Array.from({ length: 60 }, (_, step) => at(0.62 + (step / 60) * 0.2).y);
  expect(Math.max(...landing)).toBeGreaterThan(0.02);
  expect(Math.min(...landing)).toBeGreaterThanOrEqual(0);
  for (let step = 1; step < KICKFLIP.length; step++) expect(KICKFLIP[step]?.at ?? 0).toBeGreaterThan(KICKFLIP[step - 1]?.at ?? 1);
});

// A hash of the default markup across eyes and poses, taken before the
// realistic look was added: without `look`, every laptop draws as it did.
test("without a look, the markup is what it was before the realistic look", async () => {
  const { createHash } = await import("node:crypto");
  const html = [
    ...[DESK, PHONE, FRONT].flatMap((eye) => [
      renderToString(<Laptop eye={eye} />),
      renderToString(
        <Laptop eye={eye} closed={0.5}>
          <p>live</p>
        </Laptop>,
      ),
    ]),
    renderToString(<Laptop eye={DESK} turning lid={0.6} yaw={-20} pitch={24} />),
    renderToString(<Laptop eye={PHONE} lid={0.2} yaw={30} />),
    ...[0, 0.1, 0.3, 0.45, 0.5, 0.62, 0.8, 1].map((t) =>
      renderToString(
        <Laptop eye={DESK} free turning {...scrub(t, KICKFLIP)}>
          <p>x</p>
        </Laptop>,
      ),
    ),
    renderToString(<Laptop eye={DESK} free flat={1} />),
    renderToString(<Laptop eye={PHONE} roll={20} y={0.2} />),
  ].join("\n");
  expect(createHash("sha256").update(html).digest("hex")).toBe("6ee0f8c8e2aba27c850fea9722a0d3444d996fdc643c1f460c3ac0e72747c0b1");
  expect(renderToString(<Laptop eye={DESK} look="simple" />)).toBe(renderToString(<Laptop eye={DESK} />));
});

test.each([DESK, PHONE])("the realistic look renders on the server the same twice in every mode, with no NaN, in the machine's own colors", (eye) => {
  for (const props of [{}, { lid: 0, pitch: 30 }, { turning: true, yaw: -30, pitch: 22 }, { free: true, flat: 1 }, { free: true, ...scrub(0.45, KICKFLIP) }, { free: true, roll: 200, lid: 0 }]) {
    const render = () =>
      renderToString(
        <Laptop eye={eye} look="realistic" {...props}>
          <p>live</p>
        </Laptop>,
      );
    expect(render()).toBe(render());
    expect(render()).not.toMatch(/NaN|Infinity/);
    expect(render()).not.toMatch(/(fill|stroke):[^;"]*--vectoys-(surface|border|hairline)/);
  }
});

test("straight on, the realistic look is FRONT's product shot", () => {
  expect(renderToString(<Laptop eye={FRONT} look="realistic" />)).toBe(renderToString(<Laptop eye={FRONT} />));
});

test.each([DESK, PHONE])("realistic, the glass lies where FRONT puts the display on the lid in any look, and at flat 1 where FRONT draws it", (eye) => {
  const pose = { lid: 1, yaw: 0, pitch: eye.pitch, flat: 1, x: 0, y: 0, scale: 1, roll: 0 };
  const real = eye.trick(pose, false, true);
  const simple = eye.trick(pose);
  const [a, b] = [screenQuad(real.camera, real.glass, GLASS, { width: 1, height: 1 }), screenQuad(simple.camera, simple.glass, GLASS, { width: 1, height: 1 })];
  a.corners.forEach(([x, y], index) => {
    expect(x).toBeCloseTo(b.corners[index]?.[0] ?? 0, 4);
    expect(y).toBeCloseTo(b.corners[index]?.[1] ?? 0, 4);
  });
  // At the eye's own look the lid is still the machine's: the glass is FRONT's display on it, not the simple look's.
  const own = { ...pose, flat: 0 };
  const quad = screenQuad(eye.trick(own, false, true).camera, eye.trick(own, false, true).glass, GLASS, { width: 1, height: 1 });
  const plain = screenQuad(eye.trick(own).camera, eye.trick(own).glass, GLASS, { width: 1, height: 1 });
  expect(quad.facing).toBe(true);
  expect(quad.corners).not.toEqual(plain.corners);
});

test("realistic, the underside shows four round feet in rings, its slots and screws, and the keys their bevels", () => {
  const paths = (frame: { d: Record<string, string> }) => frame.d;
  const under = paths(DESK.trick({ lid: 0, yaw: 0, pitch: 15, flat: 0, x: 0, y: 0, scale: 1, roll: 180 }, false, true));
  for (const foot of [0, 1, 2, 3]) {
    expect(under[`sole.${foot}`]).toMatch(/^M/);
    expect(under[`bezel.${foot}`]).toMatch(/^M/);
  }
  expect(under["base.slits"]).toMatch(/^M/);
  expect(under["base.screws"]?.match(/h0/g)).toHaveLength(8);
  const open = DESK.trick({ lid: 1, yaw: 0, pitch: 15, flat: 0, x: 0, y: 0, scale: 1, roll: 0 }, false, true);
  expect(paths(open)["base.screws"]).toBe("");
  expect(paths(open)["base.slits"]).toBe("");
  // Seen from above, the keys' bevel stands a little up the screen from them, toward the deck's back.
  expect(open.bevel.y2).toBeLessThan(open.bevel.y1);
  expect(paths(DESK.trick({ lid: 1, yaw: 0, pitch: 15, flat: 0, x: 0, y: 0, scale: 1, roll: 0 }))["base.slits"]).toBeUndefined();
  const html = renderToString(<Laptop eye={DESK} look="realistic" />);
  const keys = html.match(/<g id="([^"]+-keys)">/)?.[1];
  expect(html).toContain(`style="fill:#5b5c5e;stroke:none" href="#${keys}"`);
  expect(html).toMatch(/<use transform="translate\([-\d.]+ -[\d.]+\)"/);
});
