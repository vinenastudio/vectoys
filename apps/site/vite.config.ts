import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}/src/index.ts`, import.meta.url));

// Dev only: /refs/<path> serves a local reference image from the folder in
// VECTOYS_REFS, or a folder under it, for the /realistic compare pages. Nothing
// here is built or shipped.
const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg" };
const refs = (): Plugin => ({
  name: "vectoys-refs",
  apply: "serve",
  configureServer(server) {
    const folder = process.env.VECTOYS_REFS;
    if (!folder) return;
    server.middlewares.use("/refs/", (request, response, next) => {
      let file: string;
      try {
        file = normalize(decodeURIComponent((request.url ?? "").split("?")[0] ?? "")).replace(/^\/+/, "");
      } catch {
        return next();
      }
      const type = TYPES[extname(file)];
      if (!type || file.startsWith("..")) return next();
      readFile(join(folder, file)).then(
        (body) => {
          response.setHeader("content-type", type);
          response.end(body);
        },
        () => next(),
      );
    });
  },
});

export default defineConfig({
  plugins: [react(), refs()],
  resolve: {
    alias: {
      "@vinena/vectoys-react": source("react"),
      "@vinena/vectoys": source("engine"),
    },
  },
});
