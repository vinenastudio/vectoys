import { defineConfig } from "@playwright/test";
import { PROJECTS } from "./projects";

// Text and edges draw a little differently on each OS, so the snapshots are
// made and checked on Linux only, in the Playwright image `run.sh` names.
if (process.platform !== "linux") throw new Error("Run the visual tests with `bun run test:visual`, which runs them in the Linux image CI uses.");

const PORT = 4173;

export default defineConfig({
  testDir: ".",
  testMatch: "*.visual.ts",
  snapshotPathTemplate: "{testDir}/snapshots/{projectName}/{arg}{ext}",
  outputDir: "results",
  reporter: [["list"], ["html", { outputFolder: "report", open: "never" }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
  // Room for a slow, emulated machine to draw two equal frames in a row.
  // Repeated runs differ by at most 7 pixels, each by one shade, at a toy's
  // antialiased edges; the smallest real change, a recolored gift, moves
  // thousands. 50 pixels absorbs the first and catches far less than the second.
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixels: 50 } },
  projects: PROJECTS.map(({ name, colorScheme, reducedMotion }) => ({ name, use: { colorScheme, contextOptions: { reducedMotion } } })),
  webServer: { command: `bun serve.ts ${PORT}`, url: `http://127.0.0.1:${PORT}/toys`, reuseExistingServer: false },
});
