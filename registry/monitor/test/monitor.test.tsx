import { expect, test } from "bun:test";
import { place, screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { DISPLAY, Monitor, seen, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };

test.each<Turn>([{}, { yaw: 0, pitch: 0 }, { yaw: 180 }, { yaw: 90 }, { yaw: -35, pitch: -60, tilt: 20 }, { yaw: 20, pitch: 35, tilt: -5 }])(
  "renders on the server, turned %p",
  (turn) => {
    const html = renderToString(
      <Monitor {...turn} finish="#4a5361">
        <p>live</p>
      </Monitor>,
    );
    expect(html).toContain('<svg viewBox="0 0 100 90"');
    expect(html).toContain("<p>live</p>");
    expect(html).toContain("--vectoys-finish:#4a5361");
    expect(html).not.toContain("NaN");
  },
);

test("at yaw 0 the display faces the eye and the panel draws over its stand", () => {
  const view = seen({ yaw: 0, pitch: 0 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(true);
  const parts = view.drawn.faces.map((face) => face.part);
  expect(parts.indexOf("glass")).toBeGreaterThan(parts.lastIndexOf("neck"));
  expect(renderToString(<Monitor yaw={0} pitch={0} />)).toContain("visibility:visible");
});

test("at yaw 180 the display faces away and the neck draws over the panel's back", () => {
  const view = seen({ yaw: 180 });
  expect(screenQuad(view.camera, view.glass, DISPLAY, ELEMENT).facing).toBe(false);
  const parts = view.drawn.faces.map((face) => `${face.part}.${face.role}`);
  expect(parts).not.toContain("glass.glass");
  expect(parts.indexOf("neck.bottom")).toBeGreaterThan(parts.indexOf("panel.bottom"));
  expect(renderToString(<Monitor yaw={180} />)).toContain("visibility:hidden");
});

test("tilt turns the panel's top back about the stand", () => {
  const top = (tilt: number) => {
    const { glass } = seen({ yaw: 0, pitch: 0, tilt });
    // The middle of the glass's top edge, in the model's y: toward the front is more.
    return place(glass, [0, DISPLAY.y, 0])[1];
  };
  expect(top(20)).toBeLessThan(top(0));
});

test("the shadow is left out when the eye is under the desk", () => {
  expect(seen().shadow).not.toBeNull();
  expect(seen({ pitch: 40 }).shadow).toBeNull();
});

test("with dragging and full screen off there is no tab stop and no button", () => {
  const on = renderToString(<Monitor />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Monitor"');
  const off = renderToString(<Monitor draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("<button");
  expect(off).toContain('role="img" aria-label="Monitor"');
});
