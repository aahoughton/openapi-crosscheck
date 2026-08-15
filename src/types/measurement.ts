import type {
  AdapterCapabilities,
  AdapterProvenance,
  Configuration,
  LibraryResolution,
} from "./adapter";
import type { CapabilityEvidence, VersionEvidence } from "../capability/evidence";
import type { Case } from "./case";
import type { AdapterResult } from "./result";

/**
 * The measurement artifacts, which are the primary output of this project.
 *
 * The split is between what was asked and what was answered, and it is
 * load-bearing in two directions.
 *
 * A measurement is **per library**. Running the harness against one library
 * produces that library's document and nothing else, and a document is complete
 * on its own terms: what it is, how it was built, and what it answered. Nothing
 * in it refers to another library, so a run of one and a run of four differ in
 * how many documents there are rather than in what any of them says.
 *
 * A measurement carries **no scores**. Scoring needs the expected verdict and
 * the expected values, which adapters are already forbidden from seeing, and
 * baking a judgement into the artifact would put that judgement beyond the
 * reach of anyone re-reading the raw answers. Score is derived when the corpus
 * and a measurement are joined, which is a display concern.
 *
 * The corpus is emitted once rather than copied into every document. It is the
 * questions; the documents are the answers.
 *
 * The version travels inside every document so a stored measurement is read
 * under the meaning it was written with. A change that alters what a field
 * means is a version bump, and reading an older document means reading its
 * fields with their older meaning.
 */
export const MEASUREMENT_SCHEMA_VERSION = 1;

/** One library's answers, complete on their own. */
export interface LibraryMeasurement {
  readonly schemaVersion: number;
  readonly library: string;
  readonly libraryVersion: string;
  /**
   * Where the measured package said its source lives, or `null`.
   *
   * Stored per measurement because it is a fact about the thing measured, and
   * it travels with the answers so a report reading one directory can link to
   * the source without asking a registry what is published today.
   */
  readonly librarySource: string | null;
  /**
   * How the measured library was resolved into the image.
   *
   * Stored because `libraryVersion` alone cannot be read safely without it: a
   * run measuring an unreleased tree records the release that tree was branched
   * from, and a reader has no way to tell from the version that they are
   * looking at one. `provenance.imageId` distinguishes two such runs, and this
   * is what says they need distinguishing.
   */
  readonly libraryResolution: LibraryResolution;
  /**
   * Which corpus asked these questions, as a digest of the case documents.
   *
   * A measurement names case ids and nothing else pins the questions behind
   * them. Two runs months apart can carry the same ids over a corpus that
   * changed underneath, and a report comparing them would present answers to
   * different questions as a difference in the libraries. Comparing digests is
   * how a reader, or a report generator, can tell those apart.
   */
  readonly corpusDigest: string;
  readonly capabilities: AdapterCapabilities;
  /**
   * What each stage did when it was probed, declared or not.
   *
   * Stored beside the declaration rather than checked and discarded. A
   * declared stage that cannot be demonstrated fails the gate, so one should
   * never reach a committed measurement; a disclaimed stage that the probe
   * exercised anyway is recorded here and published, because a disclaim is a
   * claim too and the reader is owed the evidence rather than the conclusion.
   */
  readonly capabilityEvidence: readonly CapabilityEvidence[];
  /** What each specification version's probe showed, declared or not. */
  readonly versionEvidence: readonly VersionEvidence[];
  readonly configuration: Configuration;
  readonly provenance: AdapterProvenance;
  /** In corpus order, one entry per case the corpus contains. */
  readonly answers: readonly CaseAnswer[];
}

/**
 * What one library did with one case.
 *
 * `AdapterResult` already carries the library name and version on every result,
 * which was right when results were grouped by case and is redundant now that
 * they are grouped by library. It stays because it is what the adapter produced,
 * and trimming a field out of a recorded answer to tidy the shape is how a
 * record stops being a record.
 */
export interface CaseAnswer {
  readonly caseId: string;
  readonly result: AdapterResult;
}

/**
 * The questions, emitted once.
 *
 * Published as its own artifact because it is the half of the pair that does not
 * depend on any library, and because a runner written in another language needs
 * exactly this to ask the same questions.
 */
export interface CorpusDocument {
  readonly schemaVersion: number;
  readonly cases: readonly Case[];
}
