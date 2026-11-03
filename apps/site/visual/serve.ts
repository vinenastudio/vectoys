import { join, normalize } from "node:path";

// Serves the built site in dist as vectoys.com does: /toys is toys.html and /submit is submit.html.
const dist = join(import.meta.dir, "../dist");
const port = Number(process.argv[2] ?? 4173);

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/\/+$/, "");
    const file = Bun.file(join(dist, path === "" ? "index.html" : path === "/toys" || path === "/submit" ? `${path}.html` : path));
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});
