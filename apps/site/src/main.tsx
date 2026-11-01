import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { startAnalytics } from "./analytics";
import { App, pageFor } from "./app";
import { INDEX_DATA, type RegistryIndex } from "./registry";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("The page has no #root to draw into.");
// The built page comes drawn, with the registry index it was drawn from; in dev it is drawn here.
const data = document.getElementById(INDEX_DATA)?.textContent;
const index: RegistryIndex | null = data ? JSON.parse(data) : null;
const app = (
  <StrictMode>
    <App index={index} page={pageFor(location.pathname)} />
  </StrictMode>
);

if (import.meta.env.DEV && location.pathname === "/realistic") {
  // Dev-only: the realistic laptop next to its references, never built.
  void import("./dev/realistic").then(({ Realistic }) =>
    createRoot(root).render(
      <StrictMode>
        <Realistic />
      </StrictMode>,
    ),
  );
} else if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);

startAnalytics();

if (import.meta.env.DEV) {
  // Dev-only: @vinena/knobs emulates color scheme, motion, contrast, locale, geo and
  // layout from inside the page (⇧K toggles it), and grabs an element's context
  // for an agent (⇧G).
  void import("@vinena/knobs")
    .then(({ mount }) => mount())
    .catch((error: unknown) => console.warn("@vinena/knobs failed to load", error));
}
