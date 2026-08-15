/**
 * A record that a human read the specification on a contested case and reached
 * a conclusion, so a later run does not re-litigate the same disagreement.
 *
 * An adjudication does not change a case's tier and the report does not treat it
 * as an answer. Promoting a divergence to conformance means editing the case to
 * carry a citation, which is a deliberate act that shows up in review, rather
 * than a note quietly acquiring the force of an oracle. A conformance case can
 * carry one too, recording why a contested tier placement stands.
 */
export interface Adjudication {
  readonly caseId: string;
  /** ISO date the reading happened. */
  readonly date: string;
  readonly by: string;
  readonly conclusion: string;
}

export const adjudications: readonly Adjudication[] = [
  {
    caseId: "query-form-array-integer-items-oas31",
    date: "2026-08-08",
    by: "claude-implementer",
    conclusion:
      "Read Appendix B. The specification leaves conversion between strings and other " +
      "primitives implementation-defined, so this stays divergence rather than becoming " +
      "a conformance case. Implementations disagreeing here are not failing anything.",
  },
  {
    caseId: "query-form-scalar-nullable-empty-oas30",
    date: "2026-08-14",
    by: "aah",
    conclusion:
      "Reviewed the contest that allowEmptyValue (default false, with its schema " +
      "interaction implementation-defined) licenses a rejecting reading of p=. The tier " +
      "stays conformance: p= carries the empty string, which the specification says is " +
      "not undefined, so this is a value in the declared serialization rather than an " +
      "empty-valued parameter standing in for omission, and allowEmptyValue governs the " +
      "latter. The dispute procedure covers alternative readings.",
  },
  {
    caseId: "query-form-scalar-nullable-empty-oas31",
    date: "2026-08-14",
    by: "aah",
    conclusion:
      "Reviewed the contest that allowEmptyValue (default false, with its schema " +
      "interaction implementation-defined) licenses a rejecting reading of p=. The tier " +
      "stays conformance: p= carries the empty string, which the specification says is " +
      "not undefined, so this is a value in the declared serialization rather than an " +
      "empty-valued parameter standing in for omission, and allowEmptyValue governs the " +
      "latter. The dispute procedure covers alternative readings.",
  },
];

/**
 * Awaiting adjudication. Each of these was contested during review with the
 * readings disagreeing, was left where it stands, and needs a recorded human
 * reading before the disagreement counts as settled rather than parked.
 *
 * - query-form-scalar-allow-reserved-unset-oas30 / -oas31: one reviewer argues
 *   the raw reserved characters are legal query bytes a receiver decodes
 *   regardless (Appendix E), so the verdict is a settled accept; another
 *   withdrew the same lean after reading the cited basis. Divergence held.
 * - path-simple-array-encoded-delimiter-oas30 / -oas31: one reviewer argues
 *   simple style is RFC 6570 by definition and expansion is injective here, so
 *   decode-then-split is the only faithful reversal and the accept is settled.
 *   Divergence held on the ground that no text obliges a receiver to reverse
 *   RFC 6570.
 * - query-form-scalar-nullable-absent-oas30 / -oas31: prose nit rather than a
 *   tier question. The question states the RFC 6570 reading (null serializes
 *   to nothing) as the only serialization of null, while the Style Examples
 *   table's undefined column offers ?p= as a rival. The tier is undisputed;
 *   the wording overstates one side.
 */
