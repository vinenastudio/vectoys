import { expect, test } from "bun:test";
import { poses, screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DISPLAY, THICKNESS, Watch, seen, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };

test.each<Turn>([{}, { yaw: 0, pitch: 0 }, { yaw: 180 }, { yaw: 90 }, { yaw: -35, pitch: -60, roll: 30 }, { yaw: 20, pitch: 35 }])(
  "renders on the server, turned %p",
  (turn) => {
    const html = renderToString(
      <Watch {...turn} finish="#e0cfb8" band="#4a5361">
        <p>live</p>
      </Watch>,
    );
    expect(html).toContain('<svg viewBox="0 0 100 100"');
    expect(html).toContain("<p>live</p>");
    expect(html).toContain("--vectoys-finish:#e0cfb8");
    expect(html).toContain("--vectoys-band:#4a5361");
    expect(html).not.toContain("NaN");
  },
);

test("at yaw 0 the display faces the eye and the sensor's face on the back is not drawn", () => {
  const view = seen({ yaw: 0, pitch: 0 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(true);
  const parts = view.drawn.faces.map((face) => `${face.part}.${face.role}`);
  expect(parts).toContain("glass.glass");
  expect(parts).not.toContain("sensor.top");
  expect(renderToString(<Watch yaw={0} pitch={0} />)).toContain("visibility:visible");
});

test("at yaw 180 the display faces away and the sensor and straps draw over the back", () => {
  const view = seen({ yaw: 180 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(false);
  const parts = view.drawn.faces.map((face) => `${face.part}.${face.role}`);
  expect(parts).not.toContain("glass.glass");
  expect(parts.indexOf("sensor.top")).toBeGreaterThan(parts.indexOf("case.bottom"));
  expect(parts.indexOf("strap-top-0.bottom")).toBeGreaterThan(parts.indexOf("case.bottom"));
  expect(renderToString(<Watch yaw={180} />)).toContain("visibility:hidden");
});

test("the crown shows from the right and hides behind the case from the left", () => {
  const crown = (yaw: number) => seen({ yaw, pitch: 0 }).drawn.faces.some((face) => face.part === "crown-face");
  expect(crown(-90)).toBe(true);
  expect(crown(90)).toBe(false);
});

test("the straps bend back, behind the display", () => {
  const all = poses(seen({ yaw: 0, pitch: 0 }).scene);
  // The model's y runs toward the eye, and the case's back is at -THICKNESS / 2.
  for (const tip of ["strap-top-5", "strap-bottom-5"]) expect(all.get(tip)!.position[1]).toBeLessThan(-THICKNESS / 2);
});

test("the shadow is left out when the eye is under the ground", () => {
  expect(seen().shadow).not.toBeNull();
  expect(seen({ pitch: 40 }).shadow).toBeNull();
});

test("the display clips live HTML to its rounded corners", () => {
  const html = renderToString(<Watch><p>live</p></Watch>);
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
});

test("with dragging and full screen off there is no tab stop and no button", () => {
  const on = renderToString(<Watch />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Smartwatch"');
  const off = renderToString(<Watch draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("<button");
  expect(off).toContain('role="img" aria-label="Smartwatch"');
});
