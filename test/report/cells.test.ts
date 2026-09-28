import { describe, expect, it } from "vitest";
import type { AdapterResult } from "../../src/types/result";
import { STAGE_SLOTS, valuesCell, valuesText, verdictText } from "../../src/report/cells";

/**
 * The words a cell holds, which every reading of a measurement shares.
 */

const base = {
  library: "lib",
  libraryVersion: "1.0.0",
  configurationId: "fixture",
  preparse: null,
} as const;

function accepted(deserialized: Extract<AdapterResult, { outcome: "accepted" }>["deserialized"]) {
  return {
    ...base,
    outcome: "accepted",
    deserialized,
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  } as const satisfies AdapterResult;
}

describe("a verdict cell", () => {
  it("keeps a refusal to ask, a raise and a harness fault apart from a verdict", () => {
    expect(verdictText(accepted({ kind: "unexposed", reason: "r" }))).toBe("accepted");
    expect(
      verdictText({ ...base, outcome: "unsupported", reason: "stageNotOwned", detail: "d" }),
    ).toBe("not asked (stageNotOwned)");
    expect(verdictText({ ...base, outcome: "libraryError", detail: "d", raw: null })).toBe(
      "raised, no verdict",
    );
    expect(verdictText({ ...base, outcome: "adapterError", detail: "d", raw: null })).toBe(
      "harness error",
    );
  });
});

describe("a values cell", () => {
  it("names the vantage the values were read from", () => {
    const answer = accepted({
      kind: "observed",
      vantage: "parsedBeforeValidation",
      value: { p: "blue" },
      nativeTypes: {},
    });
    expect(valuesText(answer)).toBe('{"p":"blue"} (parsed before validation)');
    expect(valuesCell(answer)).toBe('`{"p":"blue"}` (parsed before validation)');
  });

  it("says the same words in markdown and in plain text", () => {
    const answer = accepted({
      kind: "observed",
      vantage: "handedToHandler",
      value: { p: "a|b" },
      nativeTypes: {},
      unreadable: { q: "no slot" },
    });
    expect(valuesCell(answer).replace(/`/g, "").replace(/\\\|/g, "|")).toBe(valuesText(answer));
  });

  it("keeps the reason a library exposed nothing", () => {
    expect(valuesText(accepted({ kind: "unexposed", reason: "no call" }))).toBe(
      "not exposed by this library (no call)",
    );
    expect(valuesText(accepted({ kind: "notReached", reason: "no route" }))).toBe(
      "none reached (no route)",
    );
  });
});

describe("the stage slots", () => {
  it("give every slot a distinct label", () => {
    const labels = STAGE_SLOTS.map((slot) => slot.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
