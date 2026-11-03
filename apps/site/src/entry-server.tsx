import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { App } from "./app";
import type { Page } from "./pages";
import type { RegistryIndex } from "./registry";

/** A page's markup, drawn at build time from the registry index. */
export function render(index: RegistryIndex, page: Page) {
  return renderToString(
    <StrictMode>
      <App index={index} page={page} />
    </StrictMode>,
  );
}
