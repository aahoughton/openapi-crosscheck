import { describe, expect, it } from "vitest";
import { delegatedSplits } from "../../src/types/adapter";
import type { AdapterCapabilities } from "../../src/types/adapter";
import { SPLITTABLE_LOCATIONS } from "../../src/types/pipeline";
import { CAPABILITY_PROBES } from "../../src/capability/probes";

/**
 * Which locations splitting is claimed for, checked rather than assumed.
 *
 * `delegatedSplits()` writes its keys out by hand, and the harness acts on the
 * record it returns: a location missing from it is a location the harness
 * supplies nothing for, which the protocol reads as the container's own. So the
 * set of locations the type admits, the set the list publishes and the set the
 * function answers for have to be one set, and nothing derives any of them from
 * the others. A type error cannot report the drift, because a record short of a
 * key is a valid `Record` of the narrower union that the drift just created.
 *
 * This is what stops a fifth parameter location from joining splitting ownership
 * by arriving in `ParameterLocation`. Adding one to the union is now inert here,
 * and adding one to splitting fails this test until every container has been
 * asked.
 */

const OWNING_NOTHING: AdapterCapabilities["stages"]["splitting"] = {
  cookie: false,
  header: false,
  path: false,
  query: false,
};

function capabilities(splitting: AdapterCapabilities["stages"]["splitting"]): AdapterCapabilities {
  return {
    oasVersions: { "3.0": true, "3.1": true, "3.2": true },
    stages: {
      routing: true,
      splitting,
      styleDeserialization: true,
      contentDeserialization: true,
      schemaValidation: true,
      valueExposure: true,
    },
  };
}

describe("splitting ownership", () => {
  it("delegates exactly the locations the surface publishes as splittable", () => {
    expect(Object.keys(delegatedSplits(capabilities(OWNING_NOTHING))).sort()).toEqual(
      [...SPLITTABLE_LOCATIONS].sort(),
    );
  });

  it("delegates a location the library disclaims and withholds one it claims", () => {
    const splits = delegatedSplits(capabilities({ ...OWNING_NOTHING, query: true }));
    expect(splits.query).toBe(false);
    expect(splits.cookie).toBe(true);
  });

  it("probes splitting in every location it is claimed for", () => {
    const probed = new Set(
      CAPABILITY_PROBES.filter((probe) => probe.stage === "splitting").map(
        (probe) => probe.location,
      ),
    );
    expect([...probed].sort()).toEqual([...SPLITTABLE_LOCATIONS].sort());
  });
});
