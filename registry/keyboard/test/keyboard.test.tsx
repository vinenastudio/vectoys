import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { FIELD_WIDTH, KEYS, Keyboard, ORDER, TRAVEL, keyFor, seen } from "../src";

// Every code a US keyboard of this shape sends, as `KeyboardEvent.code` names them.
const US = [
  "Escape",
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
  "Backquote",
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  "Minus",
  "Equal",
  "Backspace",
  "Tab",
  ...[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((letter) => `Key${letter}`),
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "CapsLock",
  "Semicolon",
  "Quote",
  "Enter",
  "ShiftLeft",
  "Comma",
  "Period",
  "Slash",
  "ShiftRight",
  "Fn",
  "ControlLeft",
  "AltLeft",
  "MetaLeft",
  "Space",
  "MetaRight",
  "AltRight",
  "ArrowLeft",
  "ArrowUp",
  "ArrowDown",
  "ArrowRight",
];

test("every US key code presses exactly one key", () => {
  for (const code of US) {
    expect(keyFor(code)).toBe(code);
    expect(KEYS.filter((key) => key.id === code)).toHaveLength(1);
  }
  expect(keyFor("ControlRight")).toBe("ControlLeft");
  expect(keyFor("OSLeft")).toBe("MetaLeft");
  expect(keyFor("NumpadEnter")).toBe("Enter");
  expect(keyFor("KeyÄ")).toBeUndefined();
  // The one key past the US codes is the blank lock key at the top right.
  expect(KEYS.map((key) => key.id).filter((id) => !US.includes(id))).toEqual(["Lock"]);
});

test("each row is as wide as the others, and wide keys have their real widths", () => {
  // The arrows count in the front row once across: left, the up and down stack, right.
  const space = KEYS.find((key) => key.id === "Space");
  expect(space).toBeDefined();
  if (!space) throw new Error("no Space key");
  const front = space.y;
  const rows = new Map<number, number>();
  for (const key of KEYS) if (key.id !== "ArrowUp") rows.set(key.height === 0.5 ? front : key.y, (rows.get(key.height === 0.5 ? front : key.y) ?? 0) + key.width);
  for (const width of rows.values()) expect(width).toBeCloseTo(FIELD_WIDTH);
  const width = (id: string) => KEYS.find((key) => key.id === id)?.width;
  expect([width("Tab"), width("CapsLock"), width("ShiftLeft"), width("ShiftRight"), width("Backspace"), width("Enter"), width("Space"), width("MetaLeft")]).toEqual([
    1.5, 1.75, 2.25, 2.25, 1.5, 1.75, 5, 1.25,
  ]);
  expect(KEYS.find((key) => key.id === "ArrowUp")?.height).toBe(0.5);
});

test("renders on the server the same twice, with no props, as a named group in a turntable", () => {
  const html = renderToString(<Keyboard />);
  expect(renderToString(<Keyboard />)).toBe(html);
  expect(html).toMatch(/<div class="vectoys-turntable vectoys-keyboard-turn" tabindex="0"[^>]*><div class="vectoys-turntable-body"[^>]*><div role="group" aria-label="Keyboard"/);
  expect(html).not.toContain("NaN");
  expect(html.match(/data-key=/g)).toHaveLength(KEYS.length);
  expect(html).toMatch(/<button type="button" role="switch" aria-checked="true" class="[^"]*"[^>]*>.*Sound on<\/button>/);
  expect(html.match(/<button/g)).toHaveLength(2);
  expect(html).toContain('aria-label="Full screen Keyboard"');
  for (const legend of [">Q<", ">command<", ">caps lock<", ">return<", ">F12<", ">⌥<"]) expect(html).toContain(legend);
});

test("takes a finish and starts with the sound off when asked", () => {
  const html = renderToString(<Keyboard finish="#e8d6b0" defaultSound={false} />);
  expect(html).toContain("--vectoys-finish:#e8d6b0");
  expect(html).toContain('aria-checked="false"');
  expect(html).toContain("Sound off");
});

test("the text box is opt in, and the full screen button and the turning are on unless turned off", () => {
  expect(renderToString(<Keyboard />)).not.toContain("<textarea");
  const html = renderToString(<Keyboard typing defaultValue="hi" />);
  expect(renderToString(<Keyboard typing defaultValue="hi" />)).toBe(html);
  expect(html).toMatch(/<textarea[^>]*aria-label="Typed text"[^>]*placeholder="Click here or just start typing"[^>]*>hi<\/textarea>/);
  expect(html).toContain(">Clear</button>");
  expect(html).toContain('aria-label="Full screen Keyboard"');
  const off = renderToString(<Keyboard draggable={false} fullscreen={false} />);
  expect(off).not.toContain('tabindex="0"');
  expect(off).not.toContain("Full screen");
});

test("a pressed key sinks and its legends ride down with it", () => {
  const key = KEYS.find((one) => one.id === "KeyJ")!;
  const [rest, down] = [seen(key, 0), seen(key, TRAVEL)];
  expect(down.drawn.faces).not.toEqual(rest.drawn.faces);
  expect(down.legends).not.toBe(rest.legends);
  expect(seen(key, 0)).toBe(rest);
  expect(JSON.stringify(seen(key, TRAVEL / 2))).not.toContain("NaN");
});

test("keys draw from the back row to the front", () => {
  const at = (id: string) => ORDER.findIndex((key) => key.id === id);
  expect(at("Escape")).toBeLessThan(at("KeyQ"));
  expect(at("KeyQ")).toBeLessThan(at("Space"));
});
