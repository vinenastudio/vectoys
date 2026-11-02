// No Node imports here, so the site's browser build can use it too.

/** Who made an item, and who to credit, when its item.json does not say. */
export const AUTHOR = "vectoys (https://vectoys.com)";

/** The component an item named `name` exports: `my-toy` is `MyToy`, `3d-box` is `Item3dBox`. */
export function componentName(name: string): string {
  const joined = name
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return /^[A-Za-z]/.test(joined) ? joined : `Item${joined}`;
}
