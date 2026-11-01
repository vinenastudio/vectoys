import { useState } from "react";

/**
 * The elements a pose writes to, by name, so an item's handle redraws it
 * without a render: pass `ref(name)` as an element's `ref`, and `all(name)`
 * gives every mounted element under that name. `ref(name)` is the same
 * callback every render.
 */
export function useNodes() {
  const [nodes] = useState(() => {
    const named = new Map<string, Set<Element>>();
    const refs = new Map<string, (node: Element | null) => () => void>();
    return {
      all: (name: string) => named.get(name) ?? [],
      ref(name: string) {
        const known = refs.get(name);
        if (known) return known;
        const bound = (node: Element | null) => {
          if (!node) return () => {};
          const set = named.get(name) ?? new Set<Element>();
          named.set(name, set.add(node));
          return () => void set.delete(node);
        };
        refs.set(name, bound);
        return bound;
      },
    };
  });
  return nodes;
}

/** The named elements `useNodes` gives. */
export type Nodes = ReturnType<typeof useNodes>;
