import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LibraryMeasurement } from "../../src/types/measurement";

/**
 * The README names the libraries measured, and this is what keeps that true.
 *
 * `src/adapters/registry.ts` says no literal list of library names exists
 * anywhere else, and the README has one. That is a reasonable thing for a
 * README to have: a reader arriving at the repository should learn what it
 * measures without opening a report. It is unreasonable for it to be unchecked,
 * because the roster changes and prose does not follow.
 *
 * The other constitution tests scan `.ts` under `src` and `test`, so none of
 * them can see this. Checked in both directions: a library measured and unnamed
 * makes the README under-report, and a library named and unmeasured makes it
 * claim a measurement that does not exist.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The libraries the committed report actually contains. */
function measuredLibraries(): readonly string[] {
  const dir = join(repoRoot, "report", "libraries");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const measurement = JSON.parse(readFileSync(join(dir, name), "utf8")) as LibraryMeasurement;
      return measurement.library;
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The names in the README's roster section.
 *
 * Read from the one section rather than from the whole file, because the README
 * mentions package names elsewhere in passing and this test is about the list
 * that claims to be the roster.
 */
function namedInReadme(): readonly string[] {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const section = readme.split("## Libraries measured")[1]?.split("\n## ")[0];
  if (section === undefined) throw new Error("README has no 'Libraries measured' section");
  return [...section.matchAll(/^- `([^`]+)`$/gm)]
    .map((match) => match[1] ?? "")
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

describe("the README roster", () => {
  it("names exactly the libraries the committed report measures", () => {
    expect(namedInReadme()).toEqual(measuredLibraries());
  });
});
