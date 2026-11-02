import { expect, test } from "bun:test";
import { screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { Browser, PAGE, seen, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };

test.each<Turn>([{}, { yaw: 0, pitch: 0 }, { yaw: 180 }, { yaw: 90 }, { yaw: -35, pitch: -20, roll: 30 }, { yaw: 20, pitch: 35 }])(
  "renders on the server, turned %p",
  (turn) => {
    const html = renderToString(
      <Browser {...turn} url="vectoys.com/docs" theme="dark">
        <p>live</p>
      </Browser>,
    );
    expect(html).toContain('<svg viewBox="0 0 100 80"');
    expect(html).toContain("<p>live</p>");
    expect(html).toContain("vectoys.com/docs");
    expect(html).toContain("color-scheme:dark");
    expect(html).not.toContain("NaN");
  },
);

test("at yaw 0 the page faces the eye and the bar is drawn", () => {
  const view = seen({ yaw: 0, pitch: 0 });
  expect(screenQuad(view.camera, view.window, PAGE, ELEMENT).facing).toBe(true);
  const parts = view.drawn.faces.map((face) => face.part);
  expect(parts).toContain("bar");
  expect(parts).toContain("address");
  expect(parts.indexOf("dot-0")).toBeGreaterThan(parts.indexOf("bar"));
  expect(renderToString(<Browser yaw={0} pitch={0} />)).toContain("visibility:visible");
});

test("at yaw 180 the page faces away and only the window's back is drawn", () => {
  const view = seen({ yaw: 180 });
  expect(screenQuad(view.camera, view.window, PAGE, ELEMENT).facing).toBe(false);
  expect(view.drawn.faces.every((face) => face.part === "window")).toBe(true);
  expect(view.drawn.faces.some((face) => face.role === "bottom")).toBe(true);
  expect(renderToString(<Browser yaw={180} />)).not.toContain("visibility:visible");
});

test("a window deeper in a stack draws smaller, and offset moves it across its face", () => {
  const width = (corners: readonly (readonly [number, number])[]) => corners[1]![0] - corners[0]![0];
  const corners = (view: ReturnType<typeof seen>) => screenQuad(view.camera, view.window, PAGE, ELEMENT).corners;
  const near = corners(seen({ yaw: 0, pitch: 0 }));
  const far = corners(seen({ yaw: 0, pitch: 0 }, { depth: 200 }));
  // Against the same depth with no offset, so only the offset moves it.
  const moved = corners(seen({ yaw: 0, pitch: 0 }, { depth: 200, offset: [100, -50] }));
  expect(width(far)).toBeLessThan(width(near));
  expect(moved[0][0]).toBeGreaterThan(far[0][0]);
  expect(moved[0][1]).toBeLessThan(far[0][1]);
  expect(width(moved)).toBeCloseTo(width(far), 6);
});

test("the shadow is left out when the eye is under the ground or when asked", () => {
  expect(seen().shadow).not.toBeNull();
  expect(seen({ pitch: 40 }).shadow).toBeNull();
  expect(renderToString(<Browser shadow={false} />)).not.toContain("feGaussianBlur");
});

test("the page clips live HTML to its rounded bottom corners", () => {
  const html = renderToString(<Browser url="vectoys.com"><p>live</p></Browser>);
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
});

test("with dragging and full screen off there is no tab stop and no button", () => {
  const on = renderToString(<Browser />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Browser window"');
  const off = renderToString(<Browser draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("<button");
  expect(off).toContain('role="img" aria-label="Browser window"');
});
