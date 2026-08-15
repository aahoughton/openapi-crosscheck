import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createAdapters } from "../../src/adapters/registry";
import { cases } from "../../src/corpus/index";
import { disposeAll, measureAll } from "../../src/runner/run";
import { renderMeasurement } from "../../src/report/render";
import { adapterDirs } from "../support/adapterDirs";

/**
 * Measure the roster again and compare it with what is committed.
 *
 * The one check that needs containers, and the one nothing else can stand in
 * for: every other test reads the measurements on disk, and this is what says
 * those measurements are still what the libraries do.
 *
 * The gate does not reach the network, so it measures whatever is installed.
 * With a lockfile that is deterministic, and a difference here means either the
 * harness changed or the measurement moved. Moving to new library versions is
 * `pnpm update` plus a deliberate `pnpm regenerate`, rather than something that
 * happens to a reviewer mid-review.
 *
 * This only compares. `pnpm measure` is what writes, so the thing that produces
 * a measurement and the thing that checks it are separate programs, and a bug
 * in the writer cannot hide by also being in the checker.
 */

const reportDir = fileURLToPath(new URL("../../report", import.meta.url));
const librariesDir = join(reportDir, "libraries");

const adapters = await createAdapters(adapterDirs());
// Computed at module scope rather than in a hook, because the per-library tests
// are named from the measurements and vitest collects those names before any
// hook runs.
const measurements = await measureAll(cases, adapters);

afterAll(async () => {
  await disposeAll(adapters);
});

describe("the committed measurements match a fresh run", () => {
  it("measures every library the report holds, and no others", () => {
    const measured = measurements.map((measurement) => `${measurement.provenance.slug}.json`);
    const committed = readdirSync(librariesDir).filter((name) => name.endsWith(".json"));
    expect(measured.sort()).toEqual(committed.sort());
  });

  for (const measurement of measurements) {
    const name = `libraries/${measurement.provenance.slug}.json`;
    it(name, () => {
      expect(renderMeasurement(measurement)).toBe(readFileSync(join(reportDir, name), "utf8"));
    });
  }
});
