import { describe, expect, it } from "vitest";
import { stageReading } from "../../src/capability/evidence";
import type { CapabilityEvidence, ProbeSide } from "../../src/capability/evidence";
import type { Outcome } from "../../src/types/result";

function side(outcome: Outcome): ProbeSide {
  return {
    outcome,
    detail: null,
    observation: null,
    vantage: null,
    exposedProbedName: false,
    raw: null,
  };
}

function splitting(
  supply: CapabilityEvidence["supply"],
  declared: boolean,
  accepted: Outcome,
  rejected: Outcome,
): CapabilityEvidence {
  return {
    probeId: `splitting-cookie-${supply}`,
    stage: "splitting",
    supply,
    location: "cookie",
    asks: "test",
    declared,
    preparse: null,
    accepted: side(accepted),
    rejected: side(rejected),
  };
}

describe("stageReading", () => {
  it("refutes a splitting claim the library needs the harness to perform", () => {
    const reading = stageReading(
      [
        splitting("withoutProbedLocation", true, "rejected", "rejected"),
        splitting("withProbedLocation", true, "accepted", "rejected"),
      ],
      "splitting",
      "cookie",
    );
    expect(reading.refutedBy).toEqual(["splitting-cookie-withoutProbedLocation"]);
    expect(reading.inputNotShownReaching).toEqual([]);
  });

  it("names a disclaimed split whose control accepts both sides", () => {
    const reading = stageReading(
      [
        splitting("withoutProbedLocation", false, "accepted", "accepted"),
        splitting("withProbedLocation", false, "accepted", "accepted"),
      ],
      "splitting",
      "cookie",
    );
    expect(reading.inputNotShownReaching).toEqual(["splitting-cookie-withProbedLocation"]);
    expect(reading.refutedBy).toEqual([]);
  });

  it("reads a discriminating control as the split arriving", () => {
    const reading = stageReading(
      [
        splitting("withoutProbedLocation", false, "rejected", "rejected"),
        splitting("withProbedLocation", false, "accepted", "rejected"),
      ],
      "splitting",
      "cookie",
    );
    expect(reading.inputNotShownReaching).toEqual([]);
  });

  it("does not read a control the library declined as the split going missing", () => {
    // A library answering `unsupported` on both sides said it cannot carry the
    // input, which is the honest answer this reading asks a container for.
    const reading = stageReading(
      [splitting("withProbedLocation", false, "unsupported", "unsupported")],
      "splitting",
      "cookie",
    );
    expect(reading.inputNotShownReaching).toEqual([]);
  });

  it("leaves an owned location to the refutation rule", () => {
    const reading = stageReading(
      [splitting("withProbedLocation", true, "accepted", "accepted")],
      "splitting",
      "cookie",
    );
    expect(reading.inputNotShownReaching).toEqual([]);
  });
});
