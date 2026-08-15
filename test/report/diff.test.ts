import { describe, expect, it } from "vitest";
import type { AdapterResult } from "../../src/types/result";
import type { LibraryMeasurement } from "../../src/types/measurement";
import { compare, renderComparison } from "../../src/report/diff";

/**
 * What a comparison is allowed to say, and what it must refuse to say.
 *
 * The refusals matter more than the groupings here. A diff that prints rows
 * across two different corpora is worse than no diff, because every row looks
 * like a finding and none of them compares one question to itself.
 */

const CAPABILITIES = {
  stages: {
    routing: true,
    splitting: { cookie: true, header: true, path: true, query: true },
    styleDeserialization: true,
    contentDeserialization: true,
    schemaValidation: true,
    valueExposure: true,
  },
  oasVersions: { "3.0": false, "3.1": true, "3.2": false },
} as const;

function measurement(
  library: string,
  answers: Record<string, AdapterResult>,
  overrides: { corpusDigest?: string; schemaVersion?: number } = {},
): LibraryMeasurement {
  return {
    schemaVersion: overrides.schemaVersion ?? 1,
    library,
    libraryVersion: "1.0.0",
    librarySource: null,
    libraryResolution: { kind: "registry", specifier: "latest" },
    corpusDigest: overrides.corpusDigest ?? "sha256:same",
    capabilities: CAPABILITIES,
    capabilityEvidence: [],
    versionEvidence: [],
    configuration: { id: "c", description: "d", options: {} },
    provenance: { kind: "container", slug: library, imageId: "sha256:image", ecosystem: "npm" },
    answers: Object.entries(answers).map(([caseId, result]) => ({ caseId, result })),
  };
}

function accepted(values: Record<string, string>): AdapterResult {
  return {
    library: "l",
    libraryVersion: "1.0.0",
    configurationId: "c",
    preparse: null,
    outcome: "accepted",
    deserialized: { kind: "observed", vantage: "validatedOnly", value: values, nativeTypes: {} },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function rejected(): AdapterResult {
  return {
    library: "l",
    libraryVersion: "1.0.0",
    configurationId: "c",
    preparse: null,
    outcome: "rejected",
    deserialized: { kind: "notReached", reason: "rejected before values" },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function withheld(): AdapterResult {
  return {
    library: "l",
    libraryVersion: "1.0.0",
    configurationId: "c",
    preparse: null,
    outcome: "unsupported",
    reason: "adapterLimitation",
    detail: "the container could not put this to the library",
  };
}

describe("a comparison refuses what it cannot compare", () => {
  it("refuses two measurements over different corpora", () => {
    // A case id is a name for a question. Two runs months apart can carry the
    // same ids over a corpus that changed underneath, and every row would then
    // compare two things that were never asked alike.
    const a = measurement("x", { one: accepted({}) }, { corpusDigest: "sha256:one" });
    const b = measurement("x", { one: rejected() }, { corpusDigest: "sha256:two" });
    const result = compare(a, b);
    expect(result).toHaveProperty("reason");
    expect("reason" in result && result.reason).toContain("different corpora");
  });

  it("refuses two measurements written under different schema versions", () => {
    const a = measurement("x", { one: accepted({}) }, { schemaVersion: 1 });
    const b = measurement("x", { one: accepted({}) }, { schemaVersion: 2 });
    const result = compare(a, b);
    expect(result).toHaveProperty("reason");
    expect("reason" in result && result.reason).toContain("schema versions");
  });
});

describe("a comparison sorts what moved", () => {
  it("separates a verdict change from a value change under the same verdict", () => {
    const a = measurement("x", { one: accepted({ p: "blue" }), two: accepted({ p: "blue" }) });
    const b = measurement("x", { one: rejected(), two: accepted({ p: "black" }) });
    const result = compare(a, b);
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes).toEqual([
      { kind: "verdict", caseId: "one", from: "accepted", to: "rejected" },
      { kind: "values", caseId: "two", from: '{"p":"blue"}', to: '{"p":"black"}' },
    ]);
  });

  it("calls out the cases that entered or left unsupported", () => {
    // The group a text diff over rendered markdown hides worst, and the one a
    // library author most needs after a change.
    const a = measurement("x", { one: withheld(), two: accepted({}) });
    const b = measurement("x", { one: accepted({}), two: withheld() });
    const result = compare(a, b);
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes).toEqual([
      {
        kind: "left-unsupported",
        caseId: "one",
        from: "unsupported (adapterLimitation)",
        to: "accepted",
      },
      {
        kind: "entered-unsupported",
        caseId: "two",
        from: "accepted",
        to: "unsupported (adapterLimitation)",
      },
    ]);
  });

  it("keeps the three value answers apart", () => {
    // A library with no API that exposes values and one that had an API and
    // never reached it are different facts, so moving between them is a change.
    const notReached = rejected();
    const unexposed: AdapterResult = {
      library: "l",
      libraryVersion: "1.0.0",
      configurationId: "c",
      preparse: null,
      outcome: "rejected",
      deserialized: { kind: "unexposed", reason: "no published call returns values" },
    inputMutation: { kind: "none", detail: "fixture" },
      raw: null,
    };
    const result = compare(
      measurement("x", { one: notReached }),
      measurement("x", { one: unexposed }),
    );
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes.map((change) => change.kind)).toEqual(["values"]);
  });

  it("counts what did not move rather than listing it", () => {
    const same = measurement("x", { one: accepted({ p: "blue" }), two: rejected() });
    const result = compare(same, measurement("x", { one: accepted({ p: "blue" }), two: rejected() }));
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes).toEqual([]);
    expect(result.unchanged).toBe(2);
  });

  it("reports a case only one side holds rather than dropping it", () => {
    const result = compare(measurement("x", { one: accepted({}) }), measurement("x", {}));
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes).toEqual([{ kind: "only-in-a", caseId: "one" }]);
  });
});

describe("a comparison compares measurements, not libraries", () => {
  it("compares two different libraries over one corpus", () => {
    // Nothing here is scored, so there is no ranking to mistake this for. One
    // library across a change and two libraries over one corpus differ in the
    // same way, and refusing the second would be an opinion nothing supports.
    const result = compare(
      measurement("first", { one: accepted({ p: "blue" }) }),
      measurement("second", { one: rejected() }),
    );
    if ("reason" in result) throw new Error(result.reason);
    expect(result.changes).toEqual([
      { kind: "verdict", caseId: "one", from: "accepted", to: "rejected" },
    ]);
  });

  it("names both sides and says nothing is scored", () => {
    const a = measurement("first", { one: accepted({ p: "blue" }) });
    const b = measurement("second", { one: rejected() });
    const result = compare(a, b);
    if ("reason" in result) throw new Error(result.reason);
    const rendered = renderComparison(a, b, result);
    expect(rendered).toContain("`first`");
    expect(rendered).toContain("`second`");
    expect(rendered).toContain("Nothing here is scored");
  });

  it("flattens a value that would break the table it sits in", () => {
    const a = measurement("x", { one: accepted({ p: "a|b" }) });
    const b = measurement("x", { one: accepted({ p: "c" }) });
    const result = compare(a, b);
    if ("reason" in result) throw new Error(result.reason);
    const row = renderComparison(a, b, result)
      .split("\n")
      .find((line) => line.startsWith("| `one`"));
    expect(row).toBeDefined();
    // Escaped rather than dropped. The value is what the library returned and
    // the table is the thing that cannot hold it raw.
    expect(row).toContain("a\\|b");
    expect(row?.split(/(?<!\\)\|/)).toHaveLength(5);
  });
});
