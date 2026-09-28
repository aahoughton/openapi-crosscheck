import type { JsonValue } from "../types/json";
import type { AdapterResult } from "../types/result";
import { valuesText, verdictText } from "./cells";
import { tableCell } from "./markdown";
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
  if ("duplicate" in left) return answeredTwice("A", left.duplicate);
  const right = byCase(b);
  if ("duplicate" in right) return answeredTwice("B", right.duplicate);
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
    const before = values(from);
    const after = values(to);
    if (before.key !== after.key) {
      changes.push({ kind: "values", caseId, from: before.text, to: after.text });
      continue;
    }
    unchanged += 1;
  }

  return { changes, unchanged };
}

function answeredTwice(side: "A" | "B", caseId: string): Refusal {
  return {
    reason:
      `side ${side} answers case ${caseId} more than once, ` +
      `so there is no one answer to compare`,
  };
}

/**
 * Answers keyed by case id, or the first id the measurement answers twice.
 *
 * A measurement holds one answer per case. Two answers under one id cannot
 * both be compared, and keeping whichever a map kept last would report the
 * comparison of an answer chosen by file order.
 */
function byCase(measurement: LibraryMeasurement): Map<string, AdapterResult> | { duplicate: string } {
  const answers = new Map<string, AdapterResult>();
  for (const answer of measurement.answers) {
    if (answers.has(answer.caseId)) return { duplicate: answer.caseId };
    answers.set(answer.caseId, answer.result);
  }
  return answers;
}

/**
 * The verdict as a reader would say it, with the reason where there is one.
 *
 * The same words every other reading uses. The detail carried by a raise or a
 * harness error is left out of the comparison: it is an exception message,
 * and exception messages carry stack frames, addresses and timings that move
 * between two runs of the same code, so comparing them would bury the cases
 * that moved under ones that did not. The raw answer beside it in each
 * measurement file keeps the detail for a reader who wants it.
 */
function verdict(result: AdapterResult): string {
  return verdictText(result);
}

/**
 * The value channel as stored, as text to show and a key to compare.
 *
 * Everything a decided answer says beside its verdict takes part: which of the
 * three observations it is, the vantage, the values, the parameters the
 * container could not read, the native types, and whether the library wrote
 * back onto its input, detail included, since the detail says what changed.
 * A movement in any of them is a real movement between two runs. The key reads
 * objects with their keys sorted, so a library writing the same object in a
 * different key order is no change.
 */
function values(result: AdapterResult): { readonly text: string; readonly key: string } {
  if (result.outcome !== "accepted" && result.outcome !== "rejected") return { text: "-", key: "-" };
  const nativeTypes =
    result.deserialized.kind === "observed" ? result.deserialized.nativeTypes : {};
  const typed = Object.entries(nativeTypes)
    .sort(([one], [other]) => (one < other ? -1 : 1))
    .map(([name, type]) => `${name}: ${type}`);
  const text =
    valuesText(result) +
    (typed.length === 0 ? "" : `; native types ${typed.join(", ")}`) +
    `; input ${result.inputMutation.kind} (${result.inputMutation.detail})`;
  return {
    text,
    key: canonicalJson({
      deserialized: result.deserialized,
      inputMutation: result.inputMutation,
    } as unknown as JsonValue),
  };
}

/** JSON with every object's keys sorted, so key order is not a difference. */
function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .flatMap((key) => {
      const member = value[key];
      return member === undefined ? [] : [`${JSON.stringify(key)}:${canonicalJson(member)}`];
    });
  return `{${entries.join(",")}}`;
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
      const [shownFrom, shownTo] = cells(from, to);
      lines.push(`| \`${row.caseId}\` | ${shownFrom} | ${shownTo} |`);
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

const CELL_WIDTH = 89;

/**
 * Two sides of one row, each short enough for a table cell.
 *
 * A long value is cut to a window, and the window starts a little before the
 * first character where the two sides differ, so two sides that differ never
 * print the same. Whitespace is collapsed before the cut and pipes escaped
 * after it, so a cut never separates an escape from the pipe it escapes.
 */
export function cells(from: string, to: string): readonly [string, string] {
  const one = from.replace(/\s+/g, " ");
  const other = to.replace(/\s+/g, " ");
  if (one.length <= CELL_WIDTH + 1 && other.length <= CELL_WIDTH + 1) {
    return [tableCell(one), tableCell(other)];
  }
  let differsAt = 0;
  while (differsAt < one.length && one[differsAt] === other[differsAt]) differsAt += 1;
  const start = differsAt < CELL_WIDTH - 20 ? 0 : differsAt - 20;
  const windowed = (text: string): string =>
    (start > 0 ? "..." : "") +
    text.slice(start, start + CELL_WIDTH) +
    (text.length > start + CELL_WIDTH ? "..." : "");
  return [tableCell(windowed(one)), tableCell(windowed(other))];
}
