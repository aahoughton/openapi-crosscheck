import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { MEASUREMENT_SCHEMA_VERSION } from "../../src/types/measurement";
import { readMeasurementFile, readRun, sidecarNote } from "../../src/report/read";

/**
 * Reading a run directory, and in particular reading its sidecar.
 *
 * The sidecar is the one file in a run directory that an older harness may have
 * written, and the only one a reader is shown facts from directly. So the cases
 * worth pinning are the degenerate ones: absent, unreadable, and present with
 * fields missing. Each has to produce a fact a page can state rather than a
 * throw, because a report that refuses to render tells a reader less than one
 * that says which field it does not have.
 *
 * Absent and unreadable are separate states. An absent sidecar is ordinary,
 * since this repository does not commit its own, and a note saying the run did
 * not finish would be false for every render of it; a `run.json` holding `null`
 * has to come back as unreadable rather than throw out of the renderer.
 */

const made: string[] = [];

const EMPTY_SIDECAR = {
  startedAt: null,
  harnessRevision: null,
  harnessDirty: null,
  corpusDigest: null,
  node: null,
  platform: null,
};

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runDirectory(sidecar: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "oxc-run-"));
  made.push(dir);
  writeFileSync(
    join(dir, "corpus.json"),
    JSON.stringify({ schemaVersion: MEASUREMENT_SCHEMA_VERSION, cases: [] }),
    "utf8",
  );
  mkdirSync(join(dir, "libraries"));
  if (sidecar !== null) writeFileSync(join(dir, "run.json"), sidecar, "utf8");
  return dir;
}

const reportDir = fileURLToPath(new URL("../../report", import.meta.url));

/**
 * A copy of the committed corpus and one committed measurement, with either
 * file replaced by the text given.
 */
function copiedRun(replace: { corpus?: string; measurement?: string } = {}): {
  dir: string;
  measurementPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "oxc-run-"));
  made.push(dir);
  mkdirSync(join(dir, "libraries"));
  const name = readdirSync(join(reportDir, "libraries")).find((file) => file.endsWith(".json"));
  if (name === undefined) throw new Error("the committed report holds no measurement");
  const measurementPath = join(dir, "libraries", name);
  writeFileSync(
    join(dir, "corpus.json"),
    replace.corpus ?? readFileSync(join(reportDir, "corpus.json"), "utf8"),
  );
  writeFileSync(
    measurementPath,
    replace.measurement ?? readFileSync(join(reportDir, "libraries", name), "utf8"),
  );
  return { dir, measurementPath };
}

function committedMeasurement(): Record<string, unknown> {
  const { measurementPath } = copiedRun();
  return JSON.parse(readFileSync(measurementPath, "utf8")) as Record<string, unknown>;
}

describe("a run directory that cannot be read", () => {
  it("reads a copy of the committed report", () => {
    expect(readRun(copiedRun().dir).measurements).toHaveLength(1);
  });

  it("names a corpus.json that is not JSON", () => {
    const { dir } = copiedRun({ corpus: '{"schemaVersion": 2, "cases": [' });
    expect(() => readRun(dir)).toThrow(`${join(dir, "corpus.json")} is not valid JSON`);
  });

  it("names a measurement that is not JSON", () => {
    const { dir, measurementPath } = copiedRun({ measurement: '{"library": "x", "answ' });
    expect(() => readRun(dir)).toThrow(`${measurementPath} is not valid JSON`);
  });

  it("refuses a corpus.json written under another schema version", () => {
    const { dir } = copiedRun({ corpus: JSON.stringify({ schemaVersion: 0, cases: [] }) });
    expect(() => readRun(dir)).toThrow(`${join(dir, "corpus.json")} was written under measurement schema 0`);
  });

  it("refuses a measurement written under another schema version", () => {
    const { dir, measurementPath } = copiedRun({
      measurement: JSON.stringify({ ...committedMeasurement(), schemaVersion: 0 }),
    });
    expect(() => readRun(dir)).toThrow(`${measurementPath} was written under measurement schema 0`);
  });

  it("refuses a measurement that answered a different corpus", () => {
    const { dir, measurementPath } = copiedRun({
      measurement: JSON.stringify({ ...committedMeasurement(), corpusDigest: "sha256:other" }),
    });
    expect(() => readRun(dir)).toThrow(`${measurementPath} answered corpus sha256:other`);
  });
});

describe("one measurement file", () => {
  it("is refused under another schema version, naming the file", () => {
    const { measurementPath } = copiedRun({
      measurement: JSON.stringify({ ...committedMeasurement(), schemaVersion: 0 }),
    });
    expect(() => readMeasurementFile(measurementPath)).toThrow(measurementPath);
  });
});

describe("the run sidecar", () => {
  it("is absent when the directory holds no run.json", () => {
    expect(readRun(runDirectory(null)).sidecar).toEqual({ kind: "absent" });
  });

  it("is unreadable, not absent, when a run.json cannot be parsed", () => {
    expect(readRun(runDirectory("{ truncated mid-w")).sidecar).toEqual({ kind: "unreadable" });
  });

  // Each of these parses. Read as a record they produce a sidecar whose every
  // field is unrecorded, which reads as a harness that recorded nothing about
  // itself rather than a file that is not a sidecar, and `null` threw.
  it.each(["null", "[]", '"2026-01-01"', "12"])("is unreadable when run.json is %s", (body) => {
    expect(readRun(runDirectory(body)).sidecar).toEqual({ kind: "unreadable" });
  });

  it("says which of the two ways a sidecar is missing", () => {
    const absent = sidecarNote("<dir>", { kind: "absent" });
    const unreadable = sidecarNote("<dir>", { kind: "unreadable" });
    expect(absent).toContain("has no run.json");
    expect(unreadable).toContain("not a run sidecar");
    // The note names a cause only where there is one to name. This repository
    // does not commit its own sidecar, so the absent note is the one printed by
    // every ordinary render here and it must stay true of a finished run.
    expect(unreadable).not.toContain("did not finish");
    expect(sidecarNote("<dir>", { kind: "read", sidecar: EMPTY_SIDECAR })).toBeNull();
  });

  it("reads every field a finished run records", () => {
    const dir = runDirectory(
      JSON.stringify({
        startedAt: "2026-01-01T00:00:00.000Z",
        harness: { revision: "abcdef1234567890", dirty: true },
        corpusDigest: "sha256:beef",
        node: "v22.0.0",
        platform: "linux-x64",
      }),
    );
    expect(readRun(dir).sidecar).toEqual({
      kind: "read",
      sidecar: {
      startedAt: "2026-01-01T00:00:00.000Z",
      harnessRevision: "abcdef1234567890",
      harnessDirty: true,
      corpusDigest: "sha256:beef",
      node: "v22.0.0",
      platform: "linux-x64",
      },
    });
  });

  it("reports a field it does not have as absent rather than inventing one", () => {
    // A sidecar from a harness that predates a field, which is the case the
    // field-by-field read exists for. `dirty` is null rather than false: a run
    // that never recorded whether the tree was clean did not record that it was.
    const dir = runDirectory(JSON.stringify({ startedAt: "2026-01-01T00:00:00.000Z" }));
    expect(readRun(dir).sidecar).toEqual({
      kind: "read",
      sidecar: {
        startedAt: "2026-01-01T00:00:00.000Z",
        harnessRevision: null,
        harnessDirty: null,
        corpusDigest: null,
        node: null,
        platform: null,
      },
    });
  });

  it("ignores a field of the wrong type instead of publishing it", () => {
    const dir = runDirectory(JSON.stringify({ startedAt: 1735689600, harness: { dirty: "yes" } }));
    const state = readRun(dir).sidecar;
    if (state.kind !== "read") throw new Error(`expected a sidecar, got ${state.kind}`);
    expect(state.sidecar.startedAt).toBeNull();
    expect(state.sidecar.harnessDirty).toBeNull();
  });
});
