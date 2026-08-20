import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRun } from "../../src/report/read";
import { compareLibraryNames } from "../../src/report/view";
import { canBeAsked } from "../../src/types/pipeline";
import { OAS_VERSIONS } from "../../src/types/openapi";

/**
 * Properties every measurement must have, checked against the committed ones.
 *
 * These are properties of a measurement rather than of a run, so reading the
 * committed ones asserts them without Docker, and the container tier's byte
 * comparison in
 * `test/adapters/freshRun.test.ts` carries them to a fresh run: a fresh
 * measurement equal to a committed measurement holding these holds them too.
 *
 * The image id is the exception, because that comparison excludes it. Its
 * form is asserted here and nowhere else, and what produces it is the builder
 * rather than anything this repository writes.
 */

const run = readRun(fileURLToPath(new URL("../../report", import.meta.url)));

describe("the committed measurements", () => {
  it("answer every case, for every library", () => {
    expect(run.measurements.length).toBeGreaterThan(0);
    for (const measurement of run.measurements) {
      expect(measurement.answers).toHaveLength(run.cases.length);
    }
  });

  it("report no harness errors", () => {
    const broken = run.measurements.flatMap((measurement) =>
      measurement.answers
        .filter((answer) => answer.result.outcome === "adapterError")
        .map((answer) => `${answer.caseId} / ${measurement.library}`),
    );
    expect(broken).toEqual([]);
  });

  it("ask a library exactly the cases it declares for, version first, stage second", () => {
    // Both guards stated as one property, in the order the runner applies
    // them. It has to hold in every direction: an undeclared version is always
    // withheld as such, a declared version probing an unowned stage is
    // withheld as that, and a case passing both guards is never withheld.
    for (const measurement of run.measurements) {
      for (const { caseId, result } of measurement.answers) {
        const testCase = run.cases.find((c) => c.id === caseId);
        if (testCase === undefined) throw new Error(`no such case: ${caseId}`);
        const versionDeclared = measurement.capabilities.oasVersions[testCase.oasVersion];
        const owned = canBeAsked(measurement.capabilities.stages, testCase.dimensions);
        const reason = result.outcome === "unsupported" ? result.reason : null;
        const expected = !versionDeclared
          ? "oasVersionNotDeclared"
          : !owned
            ? "stageNotOwned"
            : null;
        const runnerIssued =
          reason === "oasVersionNotDeclared" || reason === "stageNotOwned" ? reason : null;
        expect({ case: caseId, library: measurement.library, withheld: runnerIssued }).toEqual({
          case: caseId,
          library: measurement.library,
          withheld: expected,
        });
      }
    }
  });

  it("carry version evidence for every version the protocol knows", () => {
    for (const measurement of run.measurements) {
      expect(measurement.versionEvidence.map((entry) => entry.oasVersion).sort()).toEqual(
        [...OAS_VERSIONS].sort(),
      );
      for (const entry of measurement.versionEvidence) {
        expect(entry.declared).toBe(measurement.capabilities.oasVersions[entry.oasVersion]);
      }
    }
  });

  it("record a preparse exactly for the locations a library delegates", () => {
    // The record has to be neither more nor less than what the harness did.
    // An over-claim is the failure to catch: a record covering the whole
    // request would claim path parameters a library recovered itself.
    for (const measurement of run.measurements) {
      const { splitting } = measurement.capabilities.stages;
      const expected = {
        params: splitting.path ? undefined : "supplied",
        query: splitting.query ? undefined : "supplied",
        headers: splitting.header ? undefined : "supplied",
        cookies: splitting.cookie ? undefined : "supplied",
      };
      const anySupplied = Object.values(expected).some((value) => value !== undefined);
      for (const { caseId, result } of measurement.answers) {
        if (result.outcome === "unsupported") continue;
        if (!anySupplied) {
          expect({ caseId, preparse: result.preparse }).toEqual({ caseId, preparse: null });
          continue;
        }
        const recorded = result.preparse?.result as Record<string, unknown> | undefined;
        expect({
          caseId,
          params: recorded?.["params"] === undefined ? undefined : "supplied",
          query: recorded?.["query"] === undefined ? undefined : "supplied",
          headers: recorded?.["headers"] === undefined ? undefined : "supplied",
          cookies: recorded?.["cookies"] === undefined ? undefined : "supplied",
        }).toEqual({ caseId, ...expected });
      }
    }
  });

  it("name the image that answered, in the form the builder reports", () => {
    for (const measurement of run.measurements) {
      expect(measurement.provenance.kind).toBe("container");
      expect(measurement.provenance.imageId).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("are ordered by library name, once each, with a resolved version", () => {
    const names = run.measurements.map((measurement) => measurement.library);
    expect(names).toEqual([...names].sort(compareLibraryNames));
    expect(new Set(names).size).toBe(names.length);
    for (const measurement of run.measurements) {
      // Two leading components rather than three. A registry that tags
      // releases with two publishes a version this would otherwise refuse,
      // and padding it to three would record a release nobody cut.
      expect(measurement.libraryVersion).toMatch(/^\d+\.\d+/);
    }
  });
});
