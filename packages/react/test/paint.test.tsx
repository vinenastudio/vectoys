import { afterEach, expect, spyOn, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Glare, Gradient, Grain, mirrored } from "../src";
import { mount } from "./dom";

afterEach(() => document.body.replaceChildren());

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

test("a gradient with a hard edge, two stops at one offset, renders and rerenders them all with no React warnings", async () => {
  const errors = spyOn(console, "error");
  try {
    const edge = (color: string) => (
      <svg>
        <Gradient id="edge" stops={[[0, color], [0.5, color], [0.5, "white"], [1, "white"]]} />
      </svg>
    );
    const { host, rerender, unmount } = await mount(edge("black"));
    await rerender(edge("gray"));
    expect([...host.querySelectorAll("stop")].map((stop) => stop.getAttribute("offset"))).toEqual(["0", "0.5", "0.5", "1"]);
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([]);
    await unmount();
  } finally {
    errors.mockRestore();
  }
});

test("a grain's seed of 0 or below still scatters its specks over the tile", () => {
  const spots = (seed: number) => [...renderToString(<svg><Grain id="n" seed={seed} /></svg>).matchAll(/<rect x="([^"]+)" y="([^"]+)"/g)].map((match) => `${match[1]} ${match[2]}`);
  for (const seed of [0, -7]) {
    const all = spots(seed);
    expect(all).toHaveLength(140);
    expect(new Set(all).size).toBeGreaterThan(100);
    for (const value of all.flatMap((spot) => spot.split(" ").map(Number))) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(3);
    }
  }
  expect(spots(7)).toEqual(spots(7 + 2147483647));
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
