import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRun, sidecarNote } from "../../src/report/read";

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
 * Absent and unreadable are separate states rather than one. Collapsing them is
 * what let both renderers print "the run did not finish" over a directory whose
 * run finished and whose sidecar is deliberately not committed, and it left a
 * `run.json` holding `null` to throw a TypeError out of the renderer.
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
  writeFileSync(join(dir, "corpus.json"), JSON.stringify({ cases: [] }), "utf8");
  mkdirSync(join(dir, "libraries"));
  if (sidecar !== null) writeFileSync(join(dir, "run.json"), sidecar, "utf8");
  return dir;
}

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
