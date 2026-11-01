import { clamp } from "@vinena/vectoys";
import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "./motion.ts";

/** A number that changes without a render: read it now, or hear each change. */
export type Progress = {
  get(): number;
  /** Calls `listener` with each new value; returns what stops it. */
  subscribe(listener: (progress: number) => void): () => void;
};

export type UseScrubOptions = {
  /**
   * How many screens tall the track is, as its own CSS sets it (`height:
   * calc(screens * 100vh)`). The track's measured height wins; this is only
   * used while it has none.
   */
  screens: number;
};

/**
 * How far the page has scrolled through a tall track element, for a scene
 * pinned inside it with `position: sticky` that scrubs as the page scrolls:
 * 0 while the track's top is at or below the viewport's top, 1 once its
 * bottom reaches the viewport's bottom. `progress` changes without a render,
 * at most once a frame, so a scene reads it in `subscribe` and writes to
 * the page itself, such as through a laptop's `ref.set`. On the server, and
 * until the effect runs, it is 0. `reduced` is whether the page asks for
 * less motion, when a scene would rather show still frames with no pinning.
 */
export function useScrub(ref: RefObject<HTMLElement | null>, { screens }: UseScrubOptions): { progress: Progress; reduced: boolean } {
  const reduced = useReducedMotion();
  const [store] = useState(() => {
    let value = 0;
    const listeners = new Set<(progress: number) => void>();
    return {
      progress: {
        get: () => value,
        subscribe(listener: (progress: number) => void) {
          listeners.add(listener);
          return () => void listeners.delete(listener);
        },
      },
      set(next: number) {
        if (next === value) return;
        value = next;
        for (const listener of listeners) listener(next);
      },
    };
  });

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const track = ref.current;
      if (!track) return;
      const { top, height } = track.getBoundingClientRect();
      const viewport = window.innerHeight;
      const distance = height > viewport ? height - viewport : (screens - 1) * viewport;
      store.set(distance > 0 ? clamp(-top / distance, 0, 1) : top <= 0 ? 1 : 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, screens, store]);

  return { progress: store.progress, reduced };
}
