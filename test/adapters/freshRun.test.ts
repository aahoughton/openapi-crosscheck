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
 * Building an image reaches the network, because every container installs its
 * library at the current release. So a difference here means the harness
 * changed, the measurement moved, or the library released since the report was
 * committed. All three want the same response: a deliberate `pnpm regenerate`
 * rather than something that happens to a reviewer mid-review.
 *
 * Every byte is compared except the image id, which is excluded because it is
 * the one field defined not to reproduce: it identifies the build that
 * answered, so two builds of one version differ there on purpose. Comparing it
 * would fail whenever the layer cache is cold and nothing at all is stale.
 * `corpusDigest` is a digest too and stays compared, so the exclusion is
 * written against the field rather than against the shape of a hash.
 *
 * This only compares. `pnpm measure` is what writes, so the thing that produces
 * a measurement and the thing that checks it are separate programs, and a bug
 * in the writer cannot hide by also being in the checker.
 */

const reportDir = fileURLToPath(new URL("../../report", import.meta.url));
const librariesDir = join(reportDir, "libraries");

/**
 * Blank the image id, whatever it says.
 *
 * Matched on the field rather than on the shape of a hash, so `corpusDigest`
 * is untouched and an id in some form a future builder reports is excluded
 * like any other. Matching the shape too would leave such an id compared, and
 * it would surface as a measurement that moved rather than as what it is.
 */
function exceptImageId(measurement: string): string {
  return measurement.replace(/("imageId": ")[^"]*(")/g, "$1<image>$2");
}

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
      expect(exceptImageId(renderMeasurement(measurement))).toBe(
        exceptImageId(readFileSync(join(reportDir, name), "utf8")),
      );
    });
  }
});
