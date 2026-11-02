import { expect, test } from "bun:test";
import { screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DISPLAY, Phone, seen, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };

test.each<Turn>([{}, { yaw: 0, pitch: 0 }, { yaw: 180 }, { yaw: 90 }, { yaw: -35, pitch: -20, roll: 30 }, { yaw: 30, pitch: 25 }])(
  "renders on the server, turned %p",
  (turn) => {
    const html = renderToString(
      <Phone {...turn} finish="#5b6b8c">
        <p>live</p>
      </Phone>,
    );
    expect(html).toContain('<svg viewBox="0 0 100 100"');
    expect(html).toContain("<p>live</p>");
    expect(html).toContain("--vectoys-finish:#5b6b8c");
    expect(html).not.toContain("NaN");
  },
);

test("at yaw 0 the display faces the eye and the bump's back is not drawn", () => {
  const view = seen({ yaw: 0, pitch: 0 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(true);
  expect(view.drawn.faces.some((face) => face.part === "glass")).toBe(true);
  expect(view.drawn.faces.some((face) => face.part === "bump" && face.role === "top")).toBe(false);
  expect(renderToString(<Phone yaw={0} pitch={0} />)).toContain("visibility:visible");
});

test("at yaw 180 the display faces away and the bump and its lenses are drawn over the back", () => {
  const view = seen({ yaw: 180 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(false);
  const parts = view.drawn.faces.map((face) => `${face.part}.${face.role}`);
  expect(parts).not.toContain("glass.glass");
  expect(parts).toContain("bump.top");
  expect(parts).toContain("lens-0-glass.lens");
  expect(parts.indexOf("bump.top")).toBeGreaterThan(parts.indexOf("body.bottom"));
  expect(renderToString(<Phone yaw={180} />)).toContain("visibility:hidden");
});

test("the shadow is left out when the eye is under the ground", () => {
  expect(seen().shadow).not.toBeNull();
  expect(seen({ pitch: 40 }).shadow).toBeNull();
});

test("the display clips live HTML to its rounded corners", () => {
  const html = renderToString(<Phone><p>live</p></Phone>);
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
});

test("with dragging and full screen off there is no tab stop and no button", () => {
  const on = renderToString(<Phone />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Phone"');
  const off = renderToString(<Phone draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("<button");
  expect(off).toContain('role="img" aria-label="Phone"');
});
