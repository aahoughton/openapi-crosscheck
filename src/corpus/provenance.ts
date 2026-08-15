/**
 * Figures this repository did not measure.
 *
 * The project's rule is that every published cell traces to stored raw output.
 * A number sourced from somewhere else cannot meet that rule, so it is not
 * allowed to sit in the report's prose looking like one that does. It is
 * carried here instead, printed in one labelled place, and attributed.
 *
 * `reproducedHere` is the literal `false` rather than a boolean. Flipping it
 * would not compile, which is the point: reproducing a figure means running the
 * survey and storing its dataset in this repository, not editing a flag.
 */
export interface ExternalFigure {
  readonly id: string;
  readonly claim: string;
  readonly figures: readonly string[];
  readonly reportedBy: string;
  /** ISO date the figure was reported to this project. */
  readonly date: string;
  readonly source: string;
  readonly reproducedHere: false;
  /** What reproducing it would take, so the gap is actionable rather than noted. */
  readonly toReproduce: string;
}

export const externalFigures: readonly ExternalFigure[] = [
  {
    id: "declared-style-exposure",
    claim:
      "Most published parameters declare no style, so the default-resolution path carries " +
      "more real traffic than any declared style, and matrix and label carry almost none.",
    figures: [
      "301 documents surveyed, 56,555 parameters",
      "style undeclared on 52,027 parameters (91.99%)",
      "explode undeclared on 52,989 of 56,555",
      "matrix declared in 0 of 301 documents, label in 0 of 301",
      "263 of 301 documents are OpenAPI 3.0",
    ],
    reportedBy: "the engagement coordinator",
    date: "2026-08-08",
    source: "APIs.guru corpus",
    reproducedHere: false,
    toReproduce:
      "download the corpus at a recorded version, count parameters by declared style and " +
      "location, and commit the resulting dataset so the figures trace to stored output " +
      "the way every other number in this report does",
  },
];
