import { writeFileSync } from "node:fs";
import { missingBaselines, newItems, parseItems } from "./baselines";

// For the `visual` job in CI.
//   bun baselines-ci.ts new <base-ref>   prints the item folders HEAD adds over <base-ref>, as a comma list
//   bun baselines-ci.ts needed <file>    of VECTOYS_NEW_ITEMS, prints the ones with no snapshots and writes
//                                        them, with PR_NUMBER and HEAD_SHA, to <file> as JSON
const [command, arg] = process.argv.slice(2);

function registry(ref: string) {
  const run = Bun.spawnSync(["git", "ls-tree", "-d", "--name-only", ref, "registry/"], { stderr: "inherit" });
  if (!run.success) throw new Error(`git ls-tree ${ref} failed`);
  return run.stdout.toString().split("\n");
}

if (command === "new" && arg) {
  console.log(newItems(registry(arg), registry("HEAD")).join(","));
} else if (command === "needed" && arg) {
  const items = missingBaselines(parseItems(process.env.VECTOYS_NEW_ITEMS));
  if (items.length > 0) {
    writeFileSync(arg, JSON.stringify({ pr: Number(process.env.PR_NUMBER), sha: process.env.HEAD_SHA, items }));
    console.log(items.join(","));
  }
} else {
  throw new Error("Usage: bun baselines-ci.ts new <base-ref> | needed <file>");
}
