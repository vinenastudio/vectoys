import { afterEach, expect, test } from "bun:test";
import { camera, draw, plate, rotateX, slab, type Pose } from "@vinena/vectoys";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { Faces, Screen, Stage, placeScreen } from "../src";
import { mount } from "./dom";

afterEach(() => document.body.replaceChildren());

const EYE = camera({ height: 60, perspective: 300, yaw: -30, pitch: -20 });
const RECT = { x: -4, y: -3, width: 8, height: 6 };

/** Roles in a row that repeat, once each, as `Faces` joins them. */
const runs = (roles: readonly string[]) => roles.filter((role, index) => role !== roles[index - 1]);

test("a stage keeps the camera's aspect ratio and viewBox", () => {
  const html = renderToString(<Stage camera={EYE} />);
  expect(html).toContain('<svg viewBox="0 0 100 60"');
  expect(html).toContain("aspect-ratio:100 / 60");
  expect(html).toContain("container-type:inline-size");
});

test("each part fills its hull in its side's look before its faces", () => {
  const scene = [slab({ name: "box", box: [-5, -5, 5, 5], thickness: 2, children: [plate({ name: "glass", box: [-4, -4, 4, 4], role: "glass" })] })];
  const { faces, hulls } = draw(scene, EYE);
  const html = renderToString(
    <svg>
      <Faces faces={faces} hulls={hulls} styles={{ side: { className: "side" }, top: { className: "top" }, glass: { className: "glass" } }} />
    </svg>,
  );
  const classes = [...html.matchAll(/class="(\w+)"/g)].map((match) => match[1]);
  const box = faces.filter((face) => face.part === "box").map((face) => face.role);
  expect(classes).toEqual(["side", ...runs(box), "glass", "glass"]);
  expect(html.match(/<path/g)).toHaveLength(1 + runs(box).length + 2);
});

test("a part.role key gives one part its own look", () => {
  const scene = [slab({ name: "box", box: [-5, -5, 5, 5], thickness: 2, children: [slab({ name: "bump", box: [-2, -2, 2, 2], thickness: 1, pose: { position: [0, 0, 1], rotation: rotateX(0) } })] })];
  const { faces, hulls } = draw(scene, EYE);
  const html = renderToString(
    <svg>
      <Faces faces={faces} hulls={hulls} styles={{ side: { className: "side" }, top: { className: "top" }, "bump.top": { className: "bump" } }} />
    </svg>,
  );
  const classes = [...html.matchAll(/class="(\w+)"/g)].map((match) => match[1]);
  const roles = (part: string) => faces.filter((face) => face.part === part).map((face) => face.role);
  expect(classes).toEqual(["side", ...runs(roles("box")), "side", ...runs(roles("bump")).map((role) => (role === "top" ? "bump" : role))]);
});

test("a screen facing the eye takes a matrix and pointer events; one turned away is hidden", () => {
  const facing: Pose = { position: [0, 0, 0], rotation: rotateX(-90) };
  const away: Pose = { position: [0, 0, 0], rotation: rotateX(90) };
  const shown = renderToString(
    <Screen camera={EYE} pose={facing} rect={RECT}>
      live
    </Screen>,
  );
  expect(shown).toContain("matrix3d(");
  expect(shown).toContain("visibility:visible");
  expect(shown).toContain("pointer-events:auto");
  expect(shown).toContain("width:160px;height:120px");
  const hidden = renderToString(<Screen camera={EYE} pose={away} rect={RECT} />);
  expect(hidden).not.toContain("matrix3d(");
  expect(hidden).toContain("visibility:hidden");
});

test("a screen placeScreen turned away shows again when a render gives it a new pose that faces the eye", async () => {
  const facing: Pose = { position: [0, 0, 0], rotation: rotateX(-90) };
  const tilted: Pose = { position: [0, 0, 0], rotation: rotateX(-80) };
  const away: Pose = { position: [0, 0, 0], rotation: rotateX(90) };
  const ref = createRef<HTMLDivElement>();
  const screen = (pose: Pose) => (
    <Screen camera={EYE} pose={pose} rect={RECT} ref={ref}>
      live
    </Screen>
  );
  const { rerender, unmount } = await mount(screen(facing));
  const element = ref.current;
  if (!element) throw new Error("the screen did not mount");
  placeScreen(element, EYE, away, RECT);
  expect(element.style.visibility).toBe("hidden");
  // The same props again leave placeScreen's pose be.
  await rerender(screen(facing));
  expect(element.style.visibility).toBe("hidden");
  await rerender(screen(tilted));
  expect([element.style.visibility, element.style.pointerEvents]).toEqual(["visible", "auto"]);
  expect(element.style.transform).toContain("matrix3d(");
  await unmount();
});

test("shaded, a part's faces join by role and shade step, darker in less light", () => {
  const scene = [slab({ name: "box", box: [-5, -8, 5, 8], radii: [2, 2], thickness: 2, edge: 0.8, step: 0.5 })];
  const { faces, hulls } = draw(scene, EYE);
  const html = renderToString(
    <svg>
      <Faces faces={faces} hulls={hulls} styles={{ side: { style: { fill: "#ccc" } }, top: { style: { fill: "#eee" } } }} shading />
    </svg>,
  );
  const fills = [...html.matchAll(/<path d="[^"]*" style="fill:([^"]*)"/g)].map((match) => match[1]!);
  // The hull, then one path per role and step, never one per face.
  expect(fills.length).toBeLessThan(faces.length / 4);
  expect(new Set(fills.slice(1)).size).toBe(fills.length - 1);
  const steps = fills.map((fill) => Number(/--vectoys-step(-?\d)/.exec(fill)?.[1] ?? 0));
  expect(Math.max(...steps)).toBeGreaterThan(0);
  expect(html).toContain("--vectoys-step4:var(--vectoys-shade-color, black) calc(var(--vectoys-shade-strength, 0.5) * 50%)");
  // Every face's data is drawn once, in its part's group, past the hull.
  const data = [...html.matchAll(/ d="([^"]*)"/g)].map((match) => match[1]!).slice(1).join("");
  expect(data.length).toBe(faces.map((face) => face.d).join("").length);
  expect(html).not.toContain("NaN");
});

test("shading leaves a look without a string fill as it is", () => {
  const scene = [slab({ name: "box", box: [-5, -5, 5, 5], thickness: 2, edge: 0.5 })];
  const { faces, hulls } = draw(scene, EYE);
  const shaded = renderToString(<Faces faces={faces} hulls={hulls} styles={{ side: { className: "side" }, top: { className: "top" } }} shading />);
  expect(shaded).not.toContain("color-mix");
  expect(shaded.match(/class="side"/g)!.length).toBeGreaterThan(1);
});

test("shading leaves a fill of none or a paint server as it is", () => {
  const scene = [slab({ name: "box", box: [-5, -5, 5, 5], thickness: 2, edge: 0.5 })];
  const { faces, hulls } = draw(scene, EYE);
  const html = renderToString(
    <Faces faces={faces} hulls={hulls} styles={{ side: { style: { fill: "none" } }, top: { style: { fill: "url(#paint)" } } }} shading />,
  );
  expect(html).not.toContain("color-mix(in srgb, none");
  expect(html).not.toContain("color-mix(in srgb, url(");
  expect(html).toContain("fill:none");
  expect(html).toContain("fill:url(#paint)");
});
