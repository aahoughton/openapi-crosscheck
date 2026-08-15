import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Case } from "../types/case";
import type { CorpusDocument, LibraryMeasurement } from "../types/measurement";
import { MEASUREMENT_SCHEMA_VERSION } from "../types/measurement";
import { compareMeasurements } from "./view";

/**
 * A run directory, read.
 *
 * One directory holds one run: the questions it asked, the answers it got, and
 * a sidecar saying when. Rendering takes exactly this and nothing else, so a
 * page or a set of markdown files is a pure function of a directory somebody
 * can hand you.
 *
 * The corpus comes from the directory rather than from this checkout. A run
 * from an older harness was asked older questions, and scoring it against
 * today's corpus would report cases it was never asked as unasked, which is
 * true and useless, and would silently rescore any case whose expected verdict
 * has since changed.
 */
export interface RunDirectory {
  readonly path: string;
  readonly cases: readonly Case[];
  readonly measurements: readonly LibraryMeasurement[];
  /** From `run.json`, or which of the two ways there is none. */
  readonly sidecar: RunSidecarState;
}

/**
 * A sidecar, or the reason there is not one, kept apart because the two reasons
 * are different facts about the directory.
 *
 * `absent` is ordinary. A run that died before writing the sidecar and a
 * checkout that does not commit it both land here, and this repository's own
 * `report/` is the second case, so anything phrased as a failure would be wrong
 * every time it appeared.
 *
 * `unreadable` is a file that exists and is not a sidecar: truncated, corrupt,
 * or holding JSON that is not an object. Reporting it as `absent` would tell a
 * reader the file is missing while they are looking at it, and reporting the
 * fields as unrecorded would dress up a parse failure as a run that did not
 * record itself.
 */
export type RunSidecarState =
  | { readonly kind: "read"; readonly sidecar: RunSidecar }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable" };

/**
 * What a command says about a directory whose sidecar it could not read, or
 * null when there is nothing to say.
 *
 * Shared by both renderers because they print the same note for the same
 * reason, and the copy of it that drifted is how a note claiming the run had
 * not finished came to be printed for every render of this repository's own
 * committed report.
 */
export function sidecarNote(dir: string, state: RunSidecarState): string | null {
  if (state.kind === "read") return null;
  if (state.kind === "unreadable") {
    return (
      `note: ${dir} holds a run.json that is not a run sidecar, so nothing here ` +
      `records when the run happened.`
    );
  }
  return (
    `note: ${dir} has no run.json, so nothing here records when the run happened. ` +
    `Either the run did not finish, or the sidecar was not kept.`
  );
}

/**
 * What the sidecar says about the run, each field allowed to be absent.
 *
 * Read field by field rather than trusted as a shape, because the sidecar is
 * the one file in a run directory that an older harness may have written, and a
 * reader shown a missing field learns something true where a reader shown a
 * crash learns nothing.
 *
 * What it cannot say is which measurements it describes. Nothing in it names an
 * image, a library or a file, and nothing in a measurement names a run, so a
 * sidecar sitting beside a set of answers is evidence of adjacency. Anything
 * rendered from this says when the run in this directory happened, which is a
 * weaker claim than when these answers were measured, and the difference is
 * worth keeping in the wording.
 */
export interface RunSidecar {
  readonly startedAt: string | null;
  readonly harnessRevision: string | null;
  readonly harnessDirty: boolean | null;
  readonly corpusDigest: string | null;
  readonly node: string | null;
  readonly platform: string | null;
}

/**
 * Read a run directory, or say what is wrong with it.
 *
 * `corpus.json` is the marker: `measure` writes it first, so its presence is
 * what distinguishes a run directory from any other directory somebody typed.
 * A directory with no sidecar is read rather than refused, and the absence is
 * reported as itself. Looking at what a died run did manage to measure is the
 * ordinary way to find out why it died, and a checkout that does not commit its
 * sidecar is the ordinary case rather than a broken one.
 */
export function readRun(path: string): RunDirectory {
  if (!isDirectory(path)) throw new Error(`${path} is not a directory`);

  const corpusPath = join(path, "corpus.json");
  if (!isFile(corpusPath)) {
    throw new Error(
      `${path} holds no corpus.json, so it is not a run directory; ` +
        "`pnpm measure <adapter-dir> --out <dir>` writes one",
    );
  }

  const document = JSON.parse(readFileSync(corpusPath, "utf8")) as CorpusDocument;
  if (!Array.isArray(document.cases)) throw new Error(`${corpusPath} holds no cases`);

  return {
    path,
    cases: document.cases,
    measurements: readMeasurements(join(path, "libraries")),
    sidecar: readSidecar(path),
  };
}

/**
 * Every measurement in the directory, ordered by library name.
 *
 * Ordered by what each measurement says it is rather than by filename, so a
 * file someone renamed still lands in the same column, and so the ordering key
 * is the same one the rest of the project uses. `compareMeasurements` is that
 * key, shared with both renderers: three sorts spelled out three times is three
 * chances for one of them to say something different about which library comes
 * first.
 */
function readMeasurements(dir: string): readonly LibraryMeasurement[] {
  if (!isDirectory(dir)) return [];
  const measurements = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const path = join(dir, name);
      const measurement = JSON.parse(readFileSync(path, "utf8")) as LibraryMeasurement;
      if (typeof measurement.library !== "string" || !Array.isArray(measurement.answers)) {
        throw new Error(`${path} is not a library measurement`);
      }
      // Refused rather than read under the wrong assumptions. The version
      // travels inside every document so that a field which changed meaning is
      // caught here, and a reader that carried on would report a missing field
      // as a missing answer, or crash somewhere further in with nothing on
      // screen naming the file.
      if (measurement.schemaVersion !== MEASUREMENT_SCHEMA_VERSION) {
        throw new Error(
          `${path} was written under measurement schema ${String(measurement.schemaVersion)} ` +
            `and this checkout reads ${String(MEASUREMENT_SCHEMA_VERSION)}. ` +
            `Measure it again with this harness, or read it with the harness that wrote it.`,
        );
      }
      return measurement;
    });
  return measurements.sort(compareMeasurements);
}

/**
 * The sidecar, if the directory has one this can be read as a sidecar.
 *
 * The existence check comes first so that a missing file and an unusable one
 * stay separable: catching both in one `try` is what made the renderers report
 * a corrupt sidecar as a run that never wrote one.
 *
 * Anything that is not a JSON object is `unreadable` rather than a sidecar with
 * nothing in it. `null` parses, and reading fields off it threw a `TypeError`
 * that reached the command line as a stack trace; an array and a string parse
 * and quietly produced a run block with every field unrecorded, which reads as
 * a harness that recorded nothing rather than a file that is not a sidecar.
 */
function readSidecar(dir: string): RunSidecarState {
  const path = join(dir, "run.json");
  if (!isFile(path)) return { kind: "absent" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { kind: "unreadable" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "unreadable" };
  }

  const record = parsed as Record<string, unknown>;
  const rawHarness = record["harness"];
  const harness =
    typeof rawHarness === "object" && rawHarness !== null && !Array.isArray(rawHarness)
      ? (rawHarness as Record<string, unknown>)
      : {};
  return {
    kind: "read",
    sidecar: {
      startedAt: text(record["startedAt"]),
      harnessRevision: text(harness["revision"]),
      harnessDirty: typeof harness["dirty"] === "boolean" ? harness["dirty"] : null,
      corpusDigest: text(record["corpusDigest"]),
      node: text(record["node"]),
      platform: text(record["platform"]),
    },
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
