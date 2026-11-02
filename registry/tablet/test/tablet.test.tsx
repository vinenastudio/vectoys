import { expect, test } from "bun:test";
import { screenQuad } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { Tablet, seen, type Orientation, type Turn } from "../src";

const ELEMENT = { width: 1, height: 1 };
const ORIENTATIONS: Orientation[] = ["portrait", "landscape"];

test.each(ORIENTATIONS)("renders on the server %s, turned any way", (orientation) => {
  for (const turn of [{}, { yaw: 0, pitch: 0 }, { yaw: 180 }, { yaw: 90 }, { yaw: -35, pitch: -20, roll: 30 }] satisfies Turn[]) {
    const html = renderToString(
      <Tablet {...turn} orientation={orientation}>
        <p>live</p>
      </Tablet>,
    );
    expect(html).toContain('<svg viewBox="0 0 100 100"');
    expect(html).toContain("<p>live</p>");
    expect(html).not.toContain("NaN");
  }
});

test.each(ORIENTATIONS)("%s: at yaw 0 the display faces the eye, at yaw 180 the bump is drawn instead", (orientation) => {
  const front = seen({ yaw: 0, pitch: 0 }, orientation);
  expect(screenQuad(front.camera, front.display.pose, front.display.rect, ELEMENT).facing).toBe(true);
  expect(front.drawn.faces.some((face) => face.part === "front-camera")).toBe(true);
  expect(front.drawn.faces.some((face) => face.part === "bump" && face.role === "top")).toBe(false);
  expect(renderToString(<Tablet yaw={0} pitch={0} orientation={orientation} />)).toContain("visibility:visible");

  const back = seen({ yaw: 180 }, orientation);
  expect(screenQuad(back.camera, back.display.pose, back.display.rect, ELEMENT).facing).toBe(false);
  const parts = back.drawn.faces.map((face) => `${face.part}.${face.role}`);
  expect(parts).toContain("bump.top");
  expect(parts).toContain("lens-0-glass.lens");
  expect(parts.indexOf("bump.top")).toBeGreaterThan(parts.indexOf("body.bottom"));
  expect(renderToString(<Tablet yaw={180} orientation={orientation} />)).toContain("visibility:hidden");
});

test("on its side the content lays out level and wider than tall", () => {
  const { camera, display } = seen({ yaw: 0, pitch: 0 }, "landscape");
  const [[left, top], [right, level], [, bottom]] = screenQuad(camera, display.pose, display.rect, ELEMENT).corners;
  expect(display.rect.width).toBeGreaterThan(display.rect.height);
  expect(level).toBeCloseTo(top, 6);
  expect(right - left).toBeGreaterThan(bottom - top);
  expect(renderToString(<Tablet orientation="landscape" />)).toContain("height:834px");
});

test.each(ORIENTATIONS)("%s: the display clips live HTML to its rounded corners", (orientation) => {
  const html = renderToString(
    <Tablet orientation={orientation}>
      <p>live</p>
    </Tablet>,
  );
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  for (const style of styles) {
    const radius = style.match(/border-radius:([^;]+)/)?.[1];
    expect(radius).toBeDefined();
    expect(style).toContain(`clip-path:inset(0 round ${radius})`);
  }
});

test("with dragging and full screen off there is no tab stop and no button", () => {
  const on = renderToString(<Tablet />);
  expect(on).toContain('tabindex="0"');
  expect(on).toContain('aria-label="Full screen Tablet"');
  const off = renderToString(<Tablet draggable={false} fullscreen={false} />);
  expect(off).not.toContain("tabindex=");
  expect(off).not.toContain("<button");
  expect(off).toContain('role="img" aria-label="Tablet"');
});
