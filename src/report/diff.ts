import type { AdapterResult } from "../types/result";
import type { LibraryMeasurement } from "../types/measurement";

/**
 * What changed between two measurements, case by case.
 *
 * Display over two measurements, which is the same kind of thing the matrix is
 * over many. It scores nothing, because scoring needs the corpus and the corpus
 * is what a comparison must hold fixed rather than consult.
 *
 * Any measurement against any measurement. A common use is one library
 * before and after a fix, and the reason not to require that is that nothing
 * here reads the library name to decide what to say: two libraries answering
 * the same corpus differ in exactly the way one library does across a change,
 * and the display does not need to distinguish those cases. What must match is
 * the corpus, because a case id means nothing
 * without the question behind it.
 */

/** What became of one case between the two sides. */
export type CaseChange =
  | { readonly kind: "verdict"; readonly caseId: string; readonly from: string; readonly to: string }
  | { readonly kind: "values"; readonly caseId: string; readonly from: string; readonly to: string }
  | {
      readonly kind: "entered-unsupported";
      readonly caseId: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly kind: "left-unsupported";
      readonly caseId: string;
      readonly from: string;
      readonly to: string;
    }
  | { readonly kind: "only-in-a"; readonly caseId: string }
  | { readonly kind: "only-in-b"; readonly caseId: string };

export interface Comparison {
  readonly changes: readonly CaseChange[];
  /** Cases both sides answered the same way, counted rather than listed. */
  readonly unchanged: number;
}

/**
 * Why two measurements cannot be compared, in the reader's terms.
 *
 * Refusing beats printing a diff that appears comparable but is not. A case id
 * is a name for a question, and two runs over different corpora can carry the
 * same id over different questions, so every row would be a comparison of two
 * things that were never asked alike.
 */
export type Refusal = { readonly reason: string };

export function compare(
  a: LibraryMeasurement,
  b: LibraryMeasurement,
): Comparison | Refusal {
  if (a.corpusDigest !== b.corpusDigest) {
    return {
      reason:
        `the two measurements answered different corpora ` +
        `(${short(a.corpusDigest)} and ${short(b.corpusDigest)}), so a case id does not ` +
        `name the same question on both sides`,
    };
  }
  // The stored shape, which is what this reads. A field that moved between
  // schema versions would be read here under the wrong meaning, and the version
  // is on both documents precisely so that can be caught rather than guessed.
  if (a.schemaVersion !== b.schemaVersion) {
    return {
      reason:
        `the two measurements were written under different schema versions ` +
        `(${String(a.schemaVersion)} and ${String(b.schemaVersion)}), so the same field ` +
        `may not mean the same thing on both sides`,
    };
  }

  const left = byCase(a);
  const right = byCase(b);
  const changes: CaseChange[] = [];
  let unchanged = 0;

  for (const caseId of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const from = left.get(caseId);
    const to = right.get(caseId);
    if (from === undefined) {
      changes.push({ kind: "only-in-b", caseId });
      continue;
    }
    if (to === undefined) {
      changes.push({ kind: "only-in-a", caseId });
      continue;
    }

    const wasUnsupported = from.outcome === "unsupported";
    const isUnsupported = to.outcome === "unsupported";
    if (!wasUnsupported && isUnsupported) {
      changes.push({ kind: "entered-unsupported", caseId, from: verdict(from), to: verdict(to) });
      continue;
    }
    if (wasUnsupported && !isUnsupported) {
      changes.push({ kind: "left-unsupported", caseId, from: verdict(from), to: verdict(to) });
      continue;
    }

    if (verdict(from) !== verdict(to)) {
      changes.push({ kind: "verdict", caseId, from: verdict(from), to: verdict(to) });
      continue;
    }
    // Only where the verdict held, because a verdict change already explains
    // its own values and listing both would report one movement twice.
    if (values(from) !== values(to)) {
      changes.push({ kind: "values", caseId, from: values(from), to: values(to) });
      continue;
    }
    unchanged += 1;
  }

  return { changes, unchanged };
}

function byCase(measurement: LibraryMeasurement): Map<string, AdapterResult> {
  return new Map(measurement.answers.map((answer) => [answer.caseId, answer.result]));
}

/**
 * The verdict as a reader would say it, with the reason where there is one.
 *
 * `unsupported` alone hides the distinction the report exists to keep: a case
 * withheld because a library does not own the stage is a different fact from
 * one its container could not put to it.
 */
function verdict(result: AdapterResult): string {
  return result.outcome === "unsupported" ? `unsupported (${result.reason})` : result.outcome;
}

/**
 * The value channel as stored, keeping the three answers apart.
 *
 * A library with no API that exposes values, one that had an API and never
 * reached it, and one that returned values are three different facts, and a
 * comparison that rendered them alike would report a real movement between them
 * as no change at all.
 */
function values(result: AdapterResult): string {
  if (result.outcome !== "accepted" && result.outcome !== "rejected") return "-";
  const deserialized = result.deserialized;
  if (deserialized.kind === "unexposed") return `unexposed: ${deserialized.reason}`;
  if (deserialized.kind === "notReached") return `not reached: ${deserialized.reason}`;
  return JSON.stringify(deserialized.value);
}

function short(digest: string): string {
  return digest.slice(0, 19);
}

/** The comparison as markdown, which is what every other reading here is. */
export function renderComparison(
  a: LibraryMeasurement,
  b: LibraryMeasurement,
  comparison: Comparison,
): string {
  const lines: string[] = [];
  lines.push("# What changed");
  lines.push("");
  lines.push(`A: \`${a.library}\` ${a.libraryVersion}, image \`${a.provenance.imageId.slice(0, 19)}\``);
  lines.push("");
  lines.push(`B: \`${b.library}\` ${b.libraryVersion}, image \`${b.provenance.imageId.slice(0, 19)}\``);
  lines.push("");
  lines.push(`Corpus \`${short(a.corpusDigest)}\`, the same on both sides.`);
  lines.push("");
  lines.push(
    "Nothing here is scored. A change is a change, and whether it is an improvement " +
      "is a question for the corpus and the tier the case sits in.",
  );
  lines.push("");

  const groups: [string, CaseChange["kind"], string][] = [
    ["Verdict changed", "verdict", "The library answered differently."],
    [
      "Values changed, verdict held",
      "values",
      "The same verdict, reached over different deserialized values. The group a diff over rendered markdown hides worst.",
    ],
    [
      "Newly unsupported",
      "entered-unsupported",
      "Answered on side A and withheld on side B.",
    ],
    ["No longer unsupported", "left-unsupported", "Withheld on side A and answered on side B."],
    ["Only in A", "only-in-a", "The case is absent from side B entirely."],
    ["Only in B", "only-in-b", "The case is absent from side A entirely."],
  ];

  for (const [heading, kind, note] of groups) {
    const rows = comparison.changes.filter((change) => change.kind === kind);
    if (rows.length === 0) continue;
    lines.push(`## ${heading} (${String(rows.length)})`);
    lines.push("");
    lines.push(note);
    lines.push("");
    lines.push("| case | A | B |");
    lines.push("| --- | --- | --- |");
    for (const row of rows) {
      const from = "from" in row ? row.from : "-";
      const to = "to" in row ? row.to : "-";
      lines.push(`| \`${row.caseId}\` | ${cell(from)} | ${cell(to)} |`);
    }
    lines.push("");
  }

  if (comparison.changes.length === 0) {
    lines.push("## Nothing changed");
    lines.push("");
    lines.push(`All ${String(comparison.unchanged)} cases answered alike.`);
    lines.push("");
  } else {
    lines.push(
      `${String(comparison.unchanged)} case${comparison.unchanged === 1 ? "" : "s"} answered alike.`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

/** Values can carry pipes and newlines, and a table cell cannot. */
function cell(value: string): string {
  const flat = value.replace(/\s+/g, " ").replace(/\|/g, "\\|");
  return flat.length > 90 ? `${flat.slice(0, 89)}...` : flat;
}
