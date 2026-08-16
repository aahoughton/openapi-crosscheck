import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LibraryMeasurement } from "../../src/types/measurement";

/**
 * A disclaimed value channel, checked against the one channel a disclaim cannot
 * cover.
 *
 * `valueExposure: false` says no published call returns deserialized values. A
 * library can hand them back anyway, by writing them onto the request object
 * its caller passed, and a caller reading that object afterwards is reading a
 * real value channel. Every value cell for such a library would understate what
 * a caller can get, and the disclaim would be false in a way no probe of the
 * published surface could reach.
 *
 * So the container reports whether the input it handed over came back changed,
 * and this is the reading of it. Positive only, like the other two
 * contradictions the gate enforces: a `none` proves the library did not write
 * back on this case, a `notCompared` proves nothing either way, and neither is
 * evidence for a declaration. Only an `observed` beside a disclaim is a
 * contradiction, and it is a contradiction in two fields with no inference in
 * between.
 *
 * Over every answer rather than over a probe pair, because the container is
 * already reporting this on every case and a library that writes back only when
 * it coerces would be missed by two control cases.
 */

const librariesDir = fileURLToPath(new URL("../../report/libraries", import.meta.url));

function measurements(): readonly LibraryMeasurement[] {
  return readdirSync(librariesDir)
    .filter((name) => name.endsWith(".json"))
    .map(
      (name) => JSON.parse(readFileSync(join(librariesDir, name), "utf8")) as LibraryMeasurement,
    );
}

describe("a library that writes back has a value channel", () => {
  it("declares one wherever an answer reports the input changed", () => {
    const contradicted: string[] = [];
    for (const measurement of measurements()) {
      if (measurement.capabilities.stages.valueExposure) continue;
      for (const answer of measurement.answers) {
        const { result } = answer;
        if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
        if (result.inputMutation.kind !== "observed") continue;
        contradicted.push(`${measurement.library} on ${answer.caseId}`);
      }
    }
    expect(contradicted).toEqual([]);
  });

  it("says what it compared, on every decided answer", () => {
    const silent: string[] = [];
    for (const measurement of measurements()) {
      for (const answer of measurement.answers) {
        const { result } = answer;
        if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
        // A kind with no scope is a claim nobody can weigh: `none` means
        // nothing until it says what was held up against what.
        if (result.inputMutation.detail.trim().length === 0) {
          silent.push(`${measurement.library} on ${answer.caseId}`);
        }
      }
    }
    expect(silent).toEqual([]);
  });
});

describe("a parameter reported unreadable is reported once", () => {
  /**
   * The protocol says a name in `unreadable` must not also appear in `value`,
   * and the protocol suite says so against a probe document declaring one path
   * parameter, which no container can call unreadable. That check passes
   * vacuously for every container, so the rule was stated in three documents
   * and enforced nowhere the corpus reaches.
   *
   * Read off the committed measurements instead, which is where a container
   * that got this wrong would have already published it.
   */
  it("names no parameter as both read and unreadable", () => {
    const contradicted: string[] = [];
    for (const measurement of measurements()) {
      for (const answer of measurement.answers) {
        const { result } = answer;
        if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
        if (result.deserialized.kind !== "observed") continue;
        for (const name of Object.keys(result.deserialized.unreadable ?? {})) {
          if (Object.hasOwn(result.deserialized.value, name)) {
            contradicted.push(`${measurement.library} on ${answer.caseId}: ${name}`);
          }
        }
      }
    }
    expect(contradicted).toEqual([]);
  });

  it("says why, on every parameter it withholds", () => {
    // The same standard `unexposed` is held to. A bare marker says a value is
    // missing without saying what stopped the container reading it, and that is
    // the half that separates a container's reach from a library's silence.
    const silent: string[] = [];
    for (const measurement of measurements()) {
      for (const answer of measurement.answers) {
        const { result } = answer;
        if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
        if (result.deserialized.kind !== "observed") continue;
        for (const [name, reason] of Object.entries(result.deserialized.unreadable ?? {})) {
          if (reason.length === 0)
            silent.push(`${measurement.library} on ${answer.caseId}: ${name}`);
        }
      }
    }
    expect(silent).toEqual([]);
  });
});
