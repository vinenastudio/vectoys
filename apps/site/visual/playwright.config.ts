import { defineConfig } from "@playwright/test";

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
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  projects: [
    { name: "light", use: { colorScheme: "light", contextOptions: { reducedMotion: "no-preference" } } },
    { name: "dark", use: { colorScheme: "dark", contextOptions: { reducedMotion: "no-preference" } } },
    { name: "reduced-motion", use: { colorScheme: "light", contextOptions: { reducedMotion: "reduce" } } },
  ],
  webServer: { command: `bun serve.ts ${PORT}`, url: `http://127.0.0.1:${PORT}/toys`, reuseExistingServer: false },
});
