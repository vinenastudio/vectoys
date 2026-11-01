import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}/src/index.ts`, import.meta.url));

// Dev only: /refs/<file> serves a local reference image from the folder in
// VECTOYS_REFS for the /realistic compare page. Nothing here is built or shipped.
const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg" };
const refs = (): Plugin => ({
  name: "vectoys-refs",
  apply: "serve",
  configureServer(server) {
    const folder = process.env.VECTOYS_REFS;
    if (!folder) return;
    server.middlewares.use("/refs/", (request, response, next) => {
      const file = basename(decodeURIComponent((request.url ?? "").split("?")[0] ?? ""));
      const type = TYPES[extname(file)];
      if (!type) return next();
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
