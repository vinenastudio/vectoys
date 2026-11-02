import type { ComponentType } from "react";
import { autoPreview } from "./auto-preview";
import { BrowserPreview } from "./previews/browser";
import { CardPreview } from "./previews/card";
import { DicePreview } from "./previews/dice";
import { EnvelopePreview } from "./previews/envelope";
import { FloppyPreview } from "./previews/floppy";
import { GiftPreview } from "./previews/gift";
import { KeyboardPreview } from "./previews/keyboard";
import { KeycapPreview } from "./previews/keycap";
import { LaptopPreview } from "./previews/laptop";
import { LaptopFrontPreview } from "./previews/laptop-front";
import { MonitorPreview } from "./previews/monitor";
import { PhonePreview } from "./previews/phone";
import { Placeholder } from "./previews/placeholder";
import { SOURCES } from "./sources";
import { TabletPreview } from "./previews/tablet";
import { WatchPreview } from "./previews/watch";

/**
 * The hand-made previews on gallery cards, by the item's name in `/r/index.json`.
 * An item needs no line here: its card draws the `Demo` component that its
 * `registry/<name>/src/index.ts` exports, else its main component (`my-toy`
 * exports `MyToy`) or its default export, with no props. Add a line only to
 * show an item in a way its own exports cannot; a line here wins.
 */
export const PREVIEWS: Readonly<Record<string, ComponentType>> = {
  browser: BrowserPreview,
  card: CardPreview,
  dice: DicePreview,
  envelope: EnvelopePreview,
  floppy: FloppyPreview,
  gift: GiftPreview,
  keyboard: KeyboardPreview,
  keycap: KeycapPreview,
  laptop: LaptopPreview,
  "laptop-front": LaptopFrontPreview,
  monitor: MonitorPreview,
  phone: PhonePreview,
  tablet: TabletPreview,
  watch: WatchPreview,
};

/** The preview a gallery card draws for an item: its hand-made one, else one from its own exports, else a placeholder. */
export function previewFor(name: string): ComponentType {
  const load = SOURCES[`../../../registry/${name}/src/index.ts`];
  return PREVIEWS[name] ?? (load ? autoPreview(name, load) : Placeholder);
}
