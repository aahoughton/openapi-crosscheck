import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LibraryMeasurement } from "../../src/types/measurement";
import type { StageOwnership } from "../../src/types/pipeline";

/**
 * Every adapter README states its stage claims in prose, and this is what keeps
 * that true.
 *
 * The claims a measurement carries come from the container's `/describe`, and
 * the README beside it is a hand-written second copy. Two copies of one fact
 * drift, and this one drifted: two adapters declared `valueExposure: true` for
 * a write-back channel while their READMEs still said the stage was the
 * caller's, so a reader who trusted the README learned the opposite of what the
 * measurement published.
 *
 * Read against the committed measurement rather than against `/describe`, so
 * this stays in the fast gate. An adapter directory with no committed
 * measurement is one nobody has run, and the roster check below names it.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The row label each stage goes by in an adapter README, and the claim it reads
 * from. Exact rather than tolerant: a README spelling a row some other way is a
 * row this test cannot check, and silently skipping it is the failure mode the
 * whole file exists to close.
 */
const ROWS: readonly (readonly [string, (stages: StageOwnership) => boolean])[] = [
  ["routing", (s) => s.routing],
  ["splitting: path", (s) => s.splitting.path],
  ["splitting: query", (s) => s.splitting.query],
  ["splitting: header", (s) => s.splitting.header],
  ["splitting: cookie", (s) => s.splitting.cookie],
  ["style and explode", (s) => s.styleDeserialization],
  ["content media type", (s) => s.contentDeserialization],
  ["schema validation", (s) => s.schemaValidation],
  ["value exposure", (s) => s.valueExposure],
];

function adapterSlugs(): readonly string[] {
  return readdirSync(join(repoRoot, "adapters"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function measurementFor(slug: string): LibraryMeasurement {
  const path = join(repoRoot, "report", "libraries", `${slug}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as LibraryMeasurement;
}

/** The claims the README's stage table states, keyed by row label. */
function claimsInReadme(slug: string): Record<string, string> {
  const readme = readFileSync(join(repoRoot, "adapters", slug, "README.md"), "utf8");
  const section = readme.split("## Stage Claims")[1]?.split("\n## ")[0];
  if (section === undefined) throw new Error(`${slug}/README.md has no 'Stage Claims' section`);
  const claims: Record<string, string> = {};
  for (const match of section.matchAll(/^\|\s*([^|]+?)\s*\|\s*(owned|caller)\s*\|$/gm)) {
    claims[match[1] ?? ""] = match[2] ?? "";
  }
  return claims;
}

describe("every adapter README", () => {
  it("has a committed measurement to be checked against", () => {
    const measured = readdirSync(join(repoRoot, "report", "libraries"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -".json".length))
      .sort();
    expect(adapterSlugs()).toEqual(measured);
  });

  for (const slug of adapterSlugs()) {
    it(`states the stage claims ${slug} declares at /describe`, () => {
      const stages = measurementFor(slug).capabilities.stages;
      const declared = Object.fromEntries(
        ROWS.map(([label, read]) => [label, read(stages) ? "owned" : "caller"]),
      );
      expect(claimsInReadme(slug)).toEqual(declared);
    });
  }
});
