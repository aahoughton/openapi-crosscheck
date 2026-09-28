import { describe, expect, it } from "vitest";
import type { ConformanceCase } from "../../src/types/case";
import type { AdapterResult, DeserializedValues } from "../../src/types/result";
import { deepEqual, score } from "../../src/report/score";

/**
 * The scorer on its own, one outcome at a time.
 *
 * Every outcome the scorer can return is reached here from the smallest answer
 * that produces it, so a change to one branch shows up as that branch rather
 * than as a moved count in a rendered report.
 */

function conformanceCase(
  expected: "accepted" | "rejected",
  expectedValues: DeserializedValues | null,
): ConformanceCase {
  return {
    id: "c-oas31",
    title: "c",
    inShort: "fixture",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      {
        oasVersion: "3.1",
        anchor: "parameter-object",
        url: "https://spec.openapis.org/oas/v3.1.0#parameter-object",
        quoted: "fixture",
      },
    ],
    expected,
    expectedValues,
    rationale: "fixture",
    document: { openapi: "3.1.0", info: { title: "fixture", version: "1" }, paths: {} },
    request: { method: "GET", target: "/t", headers: [] },
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [],
  };
}

const base = {
  library: "lib",
  libraryVersion: "1.0.0",
  configurationId: "fixture",
  preparse: null,
} as const;

type Decided = Extract<AdapterResult, { outcome: "accepted" }>;

function answer(
  outcome: "accepted" | "rejected",
  deserialized: Decided["deserialized"],
): AdapterResult {
  return {
    ...base,
    outcome,
    deserialized,
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function observed(
  value: DeserializedValues,
  unreadable?: Record<string, string>,
): Decided["deserialized"] {
  return {
    kind: "observed",
    vantage: "handedToHandler",
    value,
    nativeTypes: {},
    ...(unreadable === undefined ? {} : { unreadable }),
  };
}

const expectsBlue = conformanceCase("accepted", { p: "blue" });

describe("a verdict the library did not reach", () => {
  it("scores a raise as libraryError, never as the expected rejection", () => {
    const raised: AdapterResult = { ...base, outcome: "libraryError", detail: "threw", raw: null };
    expect(score(conformanceCase("rejected", null), raised)).toBe("libraryError");
  });

  it("scores the opposite verdict as failVerdict", () => {
    expect(score(conformanceCase("rejected", null), answer("accepted", observed({})))).toBe(
      "failVerdict",
    );
  });

  it("scores a case the runner withheld as notApplicable", () => {
    const unsupported: AdapterResult = {
      ...base,
      outcome: "unsupported",
      reason: "stageNotOwned",
      detail: "fixture",
    };
    expect(score(expectsBlue, unsupported)).toBe("notApplicable");
  });

  it("scores a harness fault as adapterError", () => {
    const broke: AdapterResult = { ...base, outcome: "adapterError", detail: "d", raw: null };
    expect(score(expectsBlue, broke)).toBe("adapterError");
  });
});

describe("a right verdict with the value half unanswered", () => {
  it("scores a library with no value channel as passVerdictOnly", () => {
    expect(score(expectsBlue, answer("accepted", { kind: "unexposed", reason: "none" }))).toBe(
      "passVerdictOnly",
    );
  });

  it("scores a value channel that reached nothing as passValuesNotReached", () => {
    expect(score(expectsBlue, answer("accepted", { kind: "notReached", reason: "none" }))).toBe(
      "passValuesNotReached",
    );
  });

  it("scores a parameter the container could not read as passValuesUnreadable", () => {
    expect(score(expectsBlue, answer("accepted", observed({}, { p: "no slot" })))).toBe(
      "passValuesUnreadable",
    );
  });

  it("gives the three a different outcome each", () => {
    const outcomes = new Set([
      score(expectsBlue, answer("accepted", { kind: "unexposed", reason: "none" })),
      score(expectsBlue, answer("accepted", { kind: "notReached", reason: "none" })),
      score(expectsBlue, answer("accepted", observed({}, { p: "no slot" }))),
    ]);
    expect(outcomes.size).toBe(3);
  });
});

describe("the values a library handed back", () => {
  it("passes a case with no expected values on the verdict alone", () => {
    expect(score(conformanceCase("accepted", null), answer("accepted", observed({})))).toBe("pass");
  });

  it("fails a missing key where null was expected", () => {
    const expectsNull = conformanceCase("accepted", { p: null });
    expect(score(expectsNull, answer("accepted", observed({})))).toBe("failValue");
    expect(score(expectsNull, answer("accepted", observed({ p: null })))).toBe("pass");
  });

  it("ignores the order keys arrive in", () => {
    const expectsObject = conformanceCase("accepted", { p: { a: 1, b: 2 } });
    expect(score(expectsObject, answer("accepted", observed({ p: { b: 2, a: 1 } })))).toBe("pass");
  });
});

describe("deepEqual", () => {
  it("compares objects without regard to key order", () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(true);
  });

  it("keeps array order", () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it("tells an array from an object with index keys", () => {
    expect(deepEqual(["x"], { "0": "x" })).toBe(false);
    expect(deepEqual({ "0": "x" }, ["x"])).toBe(false);
  });

  it("tells null from a missing key", () => {
    expect(deepEqual({ a: null }, {})).toBe(false);
  });
});
