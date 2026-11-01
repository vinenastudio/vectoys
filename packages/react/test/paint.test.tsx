import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Glare, Gradient, Grain, mirrored } from "../src";

test("a gradient draws a stop for each, its opacity only where given, and passes its other attributes on", () => {
  const html = renderToString(
    <svg>
      <Gradient id="g" x2="0" y2="1" stops={[[0, "black", 0.2], [1, "#fff"]]} />
    </svg>,
  );
  expect(html).toContain('<linearGradient id="g" x2="0" y2="1">');
  expect(html).toContain('<stop offset="0" style="stop-color:black;stop-opacity:0.2"></stop>');
  expect(html).toContain('<stop offset="1" style="stop-color:#fff"></stop>');
});

test("a grain is a tile of specks scattered the same on every render, its seed changing them", () => {
  const draw = (seed?: number) => renderToString(<svg>{seed === undefined ? <Grain id="n" /> : <Grain id="n" seed={seed} />}</svg>);
  expect(draw()).toBe(draw());
  expect(draw()).toContain('<pattern id="n" patternUnits="userSpaceOnUse" width="3" height="3">');
  expect(draw().match(/<rect /g)).toHaveLength(140);
  expect(draw(3)).not.toBe(draw());
  expect(draw()).not.toMatch(/NaN|Infinity/);
});

test("mirrored stops run back from the middle", () => {
  expect(mirrored([[0, 1], [0.2, 0.5], [0.5, 0]])).toEqual([[0, 1], [0.2, 0.5], [0.5, 0], [0.8, 0.5], [1, 1]]);
});

test("a glare lies over a screen's content and takes no pointer events", () => {
  const html = renderToString(<Glare opacity={0.4} />);
  expect(html).toContain("pointer-events:none");
  expect(html).toContain("opacity:0.4");
  expect(html).toContain("inset 0 0 0 0.1cqw");
});
