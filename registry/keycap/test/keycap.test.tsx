import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Keycap, KeycapRow, TRAVEL, seen } from "../src";

test("renders on the server as a real button named by its label", () => {
  const html = renderToString(<Keycap finish="#e8d6b0">Join</Keycap>);
  expect(html).toContain('<svg viewBox="0 0 100 90"');
  expect(html).toMatch(/<button type="button"[^>]*>Join<\/button>/);
  expect(html).toContain("--vectoys-finish:#e8d6b0");
  expect(html).toContain("visibility:visible");
  expect(html).not.toContain("NaN");
});

test("passes button attributes through, so a key can submit a form or take a name of its own", () => {
  const html = renderToString(
    <Keycap type="submit" aria-label="Join the list" disabled>
      Go
    </Keycap>,
  );
  expect(html).toContain('type="submit"');
  expect(html).toContain('aria-label="Join the list"');
  expect(html).toContain("disabled");
});

test("pressing moves the cap and its label down, and lifting moves them up", () => {
  const rest = seen(0);
  const pressed = seen(TRAVEL);
  const lifted = seen(-1);
  const height = (view: ReturnType<typeof seen>) => view.top.position[2];
  expect(height(pressed)).toBeLessThan(height(rest));
  expect(height(lifted)).toBeGreaterThan(height(rest));
  const cap = (view: ReturnType<typeof seen>) => view.drawn.hulls.find((hull) => hull.part === "cap")!.d;
  expect(cap(pressed)).not.toBe(cap(rest));
  for (const view of [rest, pressed, lifted]) expect(JSON.stringify(view.drawn)).not.toContain("NaN");
});

test("the cap covers the switch it rides over, and its dish draws over its top", () => {
  const parts = seen().drawn.hulls.map((hull) => hull.part);
  expect(parts).toEqual(["deck", "housing", "cap", "dish-0", "dish-1"]);
});

test("a row is a named group with one grab button for each key, so a drag on a key turns the row", () => {
  const html = renderToString(<KeycapRow keys={["v", "e", "c"]} label="vec" />);
  expect(html).toContain('role="group" aria-label="vec"');
  expect(html.match(/<button\b[^>]*\sdata-vectoys-grab/g)).toHaveLength(3);
  expect(html).toMatch(/>v<\/button>.*>e<\/button>.*>c<\/button>/s);
});

test("className and style go on the outer box, which holds the toy and its full screen button", () => {
  const html = renderToString(<KeycapRow keys={["a"]} className="mine" style={{ width: 200 }} />);
  expect(html).toMatch(/^(<style[^>]*>[\s\S]*?<\/style>)*<div class="vectoys-turntable mine" style="width:200px"/);
  expect(html.match(/class="[^"]*\bmine\b/g)).toHaveLength(1);
});
