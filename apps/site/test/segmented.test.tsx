import { afterEach, expect, test } from "bun:test";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Segmented } from "../src/components/segmented";

afterEach(() => {
  document.body.innerHTML = "";
});

const OPTIONS = [
  ["silver", "Silver"],
  ["black", "Space black"],
  ["gold", "Gold"],
] as const;

function Finish() {
  const [finish, setFinish] = useState<(typeof OPTIONS)[number][0]>("silver");
  return <Segmented label="Finish" options={OPTIONS} value={finish} onChange={setFinish} />;
}

test("a segmented group is one Tab stop on its choice, and the arrows, Home and End move to a choice and pick it", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Finish />));
  const radios = () => [...host.querySelectorAll('[role="radio"]')];
  const state = () => radios().map((radio) => `${radio.getAttribute("aria-checked")} ${radio.getAttribute("tabindex")}`);
  const press = (key: string) => act(async () => void document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
  expect(host.querySelector('[role="radiogroup"]')?.getAttribute("aria-label")).toBe("Finish");
  expect(state()).toEqual(["true 0", "false -1", "false -1"]);
  const first = radios()[0];
  if (!(first instanceof HTMLElement)) throw new Error("no radio");
  first.focus();
  await press("ArrowRight");
  expect(state()).toEqual(["false -1", "true 0", "false -1"]);
  expect(document.activeElement).toBe(radios()[1] ?? null);
  await press("End");
  expect(state()).toEqual(["false -1", "false -1", "true 0"]);
  await press("ArrowDown");
  expect(state()).toEqual(["true 0", "false -1", "false -1"]);
  await press("ArrowLeft");
  expect(state()).toEqual(["false -1", "false -1", "true 0"]);
  await press("Home");
  expect(state()).toEqual(["true 0", "false -1", "false -1"]);
  expect(document.activeElement).toBe(radios()[0] ?? null);
  await act(async () => root.unmount());
});
