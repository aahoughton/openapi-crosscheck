import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { LibraryMeasurement } from "../types/measurement";
import { compare, renderComparison } from "../report/diff";
import { readMeasurementFile } from "../report/read";

/**
 * Compare two measurements and say what moved.
 *
 * ```
 * pnpm diff-runs <before> <after>
 * pnpm diff-runs runs/before/libraries/<name>.json runs/after/libraries/<name>.json
 * pnpm diff-runs runs/before runs/after
 * ```
 *
 * The question this answers is the one a library author asks after a fix: did
 * this move only what I meant it to. A text diff over rendered markdown hides
 * the group that matters most, the cases that entered or left `unsupported`,
 * so this compares the measurements themselves.
 *
 * Either side is a measurement file or a run directory holding exactly one. A
 * directory holding several is an error naming them, because picking one would
 * be the command deciding what the comparison is about.
 *
 * Any measurement against any measurement, including two different libraries.
 * Nothing here is scored, so there is no ranking to mistake it for, and one
 * library across a change and two libraries over one corpus differ in the same
 * way. What must match is the corpus, and `compare` refuses when it does not.
 */
async function main(): Promise<void> {
  const [first, second, ...rest] = process.argv.slice(2);
  if (first === undefined || second === undefined || rest.length > 0) {
    throw new Error(
      "diff-runs needs exactly two measurements\n" +
        "  pnpm diff-runs <before> <after>\n" +
        "each a libraries/<name>.json or a run directory holding one",
    );
  }

  const a = readMeasurement(first);
  const b = readMeasurement(second);
  const result = compare(a, b);
  if ("reason" in result) {
    throw new Error(`refusing to compare: ${result.reason}`);
  }

  process.stdout.write(renderComparison(a, b, result));
}

/** A measurement file, or the one inside a run directory. */
function readMeasurement(path: string): LibraryMeasurement {
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`${resolved} does not exist`);

  if (statSync(resolved).isDirectory()) {
    const dir = join(resolved, "libraries");
    if (!existsSync(dir)) throw new Error(`${resolved} holds no libraries/ directory`);
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const only = files[0];
    if (only === undefined) throw new Error(`${dir} holds no measurements`);
    if (files.length > 1) {
      throw new Error(
        `${dir} holds ${String(files.length)} measurements, so name the one to compare:\n` +
          files.map((name) => `  ${join(dir, name)}`).join("\n"),
      );
    }
    return readMeasurementFile(join(dir, only));
  }
  return readMeasurementFile(resolved);
}

await main();
