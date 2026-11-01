import { expect, test } from "bun:test";
import { fixed } from "@vinena/vectoys";
import { renderToString } from "react-dom/server";
import { FRONT, LaptopFront } from "../src";
import { FRONT as LAPTOP_FRONT, Laptop } from "../../laptop/src";

test("renders on the server the same twice, with the scene's viewBox", () => {
  const render = () =>
    renderToString(
      <LaptopFront>
        <p>live</p>
      </LaptopFront>,
    );
  expect(render()).toBe(render());
  expect(render()).toContain('<svg viewBox="0 0 80.124 48.3314"');
  expect(render()).toContain("<p>live</p>");
  expect(render()).not.toContain("NaN");
});

// The laptop item draws the same laptop with `eye={FRONT}`; the two never drift apart.
test.each([undefined, <p key="live">live</p>])("draws what the laptop item draws straight on, with %p", (children) => {
  expect(renderToString(<LaptopFront>{children}</LaptopFront>)).toBe(renderToString(<Laptop eye={LAPTOP_FRONT}>{children}</Laptop>));
  expect(JSON.stringify(FRONT)).toBe(JSON.stringify(LAPTOP_FRONT));
});

test("empty it is a picture, with live content a group, under its label", () => {
  expect(renderToString(<LaptopFront />)).toContain('role="img" aria-label="Laptop"');
  expect(renderToString(<LaptopFront label="Our app">x</LaptopFront>)).toContain('role="group" aria-label="Our app"');
});

test("the finish sets the aluminum's color, and without it the page's finish shows", () => {
  expect(renderToString(<LaptopFront />)).not.toContain("--vectoys-finish:");
  expect(renderToString(<LaptopFront />)).toContain("var(--vectoys-finish, #f0f1f3)");
  expect(renderToString(<LaptopFront finish="silver" />)).toContain("--vectoys-finish:#f0f1f3");
  expect(renderToString(<LaptopFront finish="black" />)).toContain("--vectoys-finish:#3d3b3e");
});

test("the glass clips live HTML to its rounded top corners, under the notch", () => {
  const html = renderToString(
    <LaptopFront>
      <p>live</p>
    </LaptopFront>,
  );
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((match) => match[1] ?? "").filter((style) => style.includes("container-type:inline-size") && style.includes("border-radius:"));
  expect(styles).toHaveLength(1);
  const across = `${fixed((FRONT.round / FRONT.glass.width) * 100)}%`;
  expect(styles[0]).toContain(`border-radius:${across} ${across} 0 0 /`);
  expect(html.indexOf("<p>live</p>")).toBeGreaterThan(html.indexOf("container-type:inline-size"));
  expect(html).toMatch(/<svg viewBox="[^"]*" preserveAspectRatio="none" aria-hidden="true" style="[^"]*pointer-events:none/);
});
