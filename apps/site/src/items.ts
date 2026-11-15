import type { ComponentType } from "react";
import { autoPreview, lazyPreview } from "./auto-preview";
import { Placeholder } from "./previews/placeholder";
import { SOURCES } from "./sources";

/**
 * The hand-made previews on gallery cards, by the item's name in `/r/index.json`.
 * Each loads with its toy only when its card comes near the screen.
 * An item needs no line here: its card draws the `Demo` component that its
 * `registry/<name>/src/index.ts` exports, else its main component (`my-toy`
 * exports `MyToy`) or its default export, with no props. Add a line only to
 * show an item in a way its own exports cannot; a line here wins.
 */
export const PREVIEWS: Readonly<Record<string, ComponentType>> = {
  browser: lazyPreview(() => import("./previews/browser").then((module) => module.BrowserPreview)),
  card: lazyPreview(() => import("./previews/card").then((module) => module.CardPreview)),
  dice: lazyPreview(() => import("./previews/dice").then((module) => module.DicePreview)),
  envelope: lazyPreview(() => import("./previews/envelope").then((module) => module.EnvelopePreview)),
  floppy: lazyPreview(() => import("./previews/floppy").then((module) => module.FloppyPreview)),
  gift: lazyPreview(() => import("./previews/gift").then((module) => module.GiftPreview)),
  keyboard: lazyPreview(() => import("./previews/keyboard").then((module) => module.KeyboardPreview)),
  keycap: lazyPreview(() => import("./previews/keycap").then((module) => module.KeycapPreview)),
  laptop: lazyPreview(() => import("./previews/laptop").then((module) => module.LaptopPreview)),
  "laptop-front": lazyPreview(() => import("./previews/laptop-front").then((module) => module.LaptopFrontPreview)),
  monitor: lazyPreview(() => import("./previews/monitor").then((module) => module.MonitorPreview)),
  phone: lazyPreview(() => import("./previews/phone").then((module) => module.PhonePreview)),
  tablet: lazyPreview(() => import("./previews/tablet").then((module) => module.TabletPreview)),
  watch: lazyPreview(() => import("./previews/watch").then((module) => module.WatchPreview)),
};

/** The preview a gallery card draws for an item: its hand-made one, else one from its own exports, else a placeholder. */
export function previewFor(name: string): ComponentType {
  // Own keys only, so an item named "constructor" does not find Object's.
  const path = `../../../registry/${name}/src/index.ts`;
  const made = Object.hasOwn(PREVIEWS, name) ? PREVIEWS[name] : undefined;
  const load = Object.hasOwn(SOURCES, path) ? SOURCES[path] : undefined;
  return made ?? (load ? autoPreview(name, load) : Placeholder);
}
