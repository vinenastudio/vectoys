import type { ComponentType } from "react";
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
import { TabletPreview } from "./previews/tablet";
import { WatchPreview } from "./previews/watch";

/**
 * The live preview on each gallery card, by the item's name in `/r/index.json`.
 * Add a line here when an item merges; an item in the index without one shows
 * a placeholder until it has.
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
