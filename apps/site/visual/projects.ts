// The visual projects, each with its own folder of snapshots, for playwright.config.ts and baselines.ts.
export const PROJECTS = [
  { name: "light", colorScheme: "light", reducedMotion: "no-preference" },
  { name: "dark", colorScheme: "dark", reducedMotion: "no-preference" },
  { name: "reduced-motion", colorScheme: "light", reducedMotion: "reduce" },
] as const;
