import type { Loader } from "./auto-preview";

/**
 * Every item's `src/index.ts`, loaded only when its card comes near the
 * screen, by its path from here. The items in PREVIEWS are left out, as their
 * hand-made previews load them already; keep this list in step with PREVIEWS.
 */
export const SOURCES: Record<string, Loader> = import.meta.glob<Record<string, unknown>>([
  "../../../registry/*/src/index.ts",
  "!../../../registry/{browser,card,dice,envelope,floppy,gift,keyboard,keycap,laptop,laptop-front,monitor,phone,tablet,watch}/src/index.ts",
]);
