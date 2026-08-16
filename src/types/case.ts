import type { JsonValue } from "./json";
import type { OasVersion, OpenApiDocument, ParameterLocation, Style } from "./openapi";
import type { WireRequest } from "./wire";

/**
 * Which boundary of a library a case measures.
 *
 * Some libraries accept a raw wire request; others accept an already-split
 * `{ params, query, headers }` and never see the target string. For the second
 * kind, the split is done by the harness, so a `wireDeserialization` verdict
 * from them would measure the harness rather than the library. The runner
 * refuses that pairing instead of expecting adapters to decline it.
 */
export type Tier = "conformance" | "divergence";

/** The declared schema shape of the parameter under probe, as a coverage coordinate. */
export type SchemaShape =
  | "array"
  | "nullableArray"
  | "nullableObject"
  | "nullableScalar"
  | "object"
  | "scalar";

/**
 * The 3f axis: what this case varies away from canonical. `canonical` is the
 * case that holds everything constant, and is the blind spot every other axis
 * exists to cover.
 */
export type ProbeAxis =
  | "canonical"
  | "caseVariant"
  | "competingParameter"
  /**
   * Two declared paths compete for the same request.
   *
   * Distinct from `competingParameter`, which is two parameters inside one
   * operation. This one is about which operation the request is for at all, and
   * it is the only axis whose cases need a document declaring more than one
   * path.
   */
  | "competingPath"
  /**
   * The case varies a parameter-level flag in the declaration, such as
   * `allowReserved`, `allowEmptyValue`, or an `explode` that turns the declared
   * combination into one the specification leaves undefined.
   *
   * Every other axis varies the wire and holds the declaration fixed. This one
   * varies the declaration, which was a constant across the whole corpus until
   * it existed, and so a blind spot no wire-shaped axis could reach.
   */
  | "declarationFlag"
  | "duplicateName"
  | "emptyAfterParse"
  | "emptyContainer"
  | "encodingVariant"
  | "foreignName"
  | "foreignWireShape"
  | "missingName"
  /**
   * The name arrives on the wire with no `=` after it at all.
   *
   * Distinct from `emptyContainer`, which sends `?p=`: there the delimiter is
   * present and the value is zero-length. Here there is no delimiter, which is
   * a wire form no expansion in the Style Examples table produces. Until this
   * axis existed every value in the corpus arrived behind its delimiter, and
   * the harness itself could not tell the two apart.
   */
  | "nameWithoutValue"
  /**
   * The declared parameter is `required: false` and the request omits it.
   *
   * Distinct from `missingName`, where a required parameter is absent and the
   * settled verdict is rejection. Here the settled verdict is acceptance, and
   * the open question lives in the value channel: an absent key, a null, and
   * a value the library supplied are all defensible things for a caller to
   * receive. Until this axis existed every declaration in the corpus was
   * required, a constant nothing published.
   */
  | "optionalAbsent"
  | "wrongTypeValue";

/** Coordinates of a case in the coverage map. */
interface CommonDimensions {
  readonly location: ParameterLocation;
  readonly schema: SchemaShape;
  readonly probeAxis: ProbeAxis;
}

/**
 * What a case varies, and against what declaration form.
 *
 * A discriminated union because the specification defines two: "The rules for
 * serialization of the parameter are specified in one of two ways. Parameter
 * Objects MUST include either a content field or a schema field, but not both."
 * A parameter declared with `content` has no `style` and no `explode` at all,
 * and recording a defaulted one for it would put a value in the corpus that the
 * document never wrote and the library never resolved.
 */
export type Dimensions =
  | (CommonDimensions & {
      readonly declaration: "schema";
      /** The style in force, whether declared or defaulted. Used for legality. */
      readonly style: Style;
      /** The explode in force, whether declared or defaulted. */
      readonly explode: boolean;
      /**
       * What the document actually wrote, as opposed to what is in force.
       *
       * Leaving style or explode out puts a different code path under test: the
       * library has to resolve the default before it can deserialize anything.
       * The defaulted path is reported to be the common one in published
       * documents, while the declared path is the one a hand-written corpus
       * reaches by habit. That report is external to this repository and is
       * recorded, attributed and unreproduced, in corpus/provenance.ts.
       *
       * Kept separate from the effective values because legality filtering needs
       * what is in force, and the coverage map needs to show both as distinct
       * cells. One measured case already turns on the difference.
       */
      readonly declaredStyle: Style | "unset";
      readonly declaredExplode: boolean | "unset";
    })
  | (CommonDimensions & {
      readonly declaration: "content";
      /** The single media type the parameter declares. */
      readonly mediaType: string;
    });

/**
 * A specification citation. A conformance case cannot be constructed without
 * one: the requirement is carried by the type, not by a convention someone has
 * to remember.
 */
export interface Citation {
  readonly oasVersion: OasVersion;
  /** Section anchor within the specification document, e.g. `style-values`. */
  readonly anchor: string;
  readonly url: string;
  /**
   * Verbatim specification text. Quoted, not paraphrased.
   *
   * Verbatim includes punctuation, so a sentence the document sets with a
   * typographic apostrophe carries one here. That sits against the rule that
   * generated output is ASCII, and the two are reconciled by the sentence in
   * `AGENTS.md` exempting data passed through from a specification: this text
   * is the specification's, and normalising it would make the quote something
   * this repository wrote.
   *
   * Recorded as tentative rather than settled. Nothing enforces the choice, and
   * the case for the other one is real: every other byte this project publishes
   * is ASCII, and a transcriber deciding faithfulness character by character is
   * how transcriptions drift. If it is revisited, the change is a normalising
   * step in the `cite` helpers and an amendment to that sentence in `AGENTS.md`,
   * applied together. What it must not become is a per-quote judgement.
   */
  readonly quoted: string;
}

export type ExpectedVerdict = "accepted" | "rejected";

interface CaseBase {
  readonly id: string;
  readonly title: string;
  /**
   * What the case does, in one sentence, for a reader scanning rather than
   * auditing.
   *
   * The corpus already says why a verdict is what it is, or why there is none,
   * and both are arguments addressed to someone checking the corpus. Neither
   * answers "what is this one doing" in the time a reader spends hovering a
   * row, and a report that can only answer that at citation length answers it
   * to nobody.
   *
   * Written rather than derived. A sentence assembled from the dimensions can
   * restate the wire form, which the request shown beside it already does, and
   * cannot say what the case is watching for, which is the half that makes a
   * row worth stopping on.
   *
   * Held to one or two sentences by test rather than by intention, because the
   * pressure on this field is to grow into a second rationale, and a paragraph
   * here is the thing it was added to replace.
   */
  readonly inShort: string;
  readonly oasVersion: OasVersion;
  readonly document: OpenApiDocument;
  readonly request: WireRequest;
  readonly dimensions: Dimensions;
  /**
   * Set when the finding is in the values and the verdict cannot carry it.
   *
   * Some questions are settled by whether a request is accepted. Others are not:
   * two libraries can accept the same request and hand their callers different
   * things, and which template a router chose or which reading of a wire value
   * it took is legible only in what comes back. A case like that asks nothing a
   * verdict column can answer.
   *
   * Declared on the case rather than derived from what the roster happened to
   * return. A case is answered in the values because of what it asks, and a rule
   * reading today's measurements would call a case value-only until a library
   * that rejects is added, then quietly stop.
   *
   * What it changes is what a report may claim. A library exposing no
   * deserialized values reaches a verdict here like any other, and that verdict
   * says nothing about the question, so the reports mark the case and say so
   * rather than printing a row that reads as an answer.
   */
  readonly answeredInValues?: true;
  /** Dimensions this case moves away from canonical. */
  readonly varies: readonly string[];
  /** Dimensions this case holds fixed. Stated because the constant is the blind spot. */
  readonly holdsConstant: readonly string[];
  /**
   * Set when the document deliberately breaks a rule addressed to whoever wrote
   * it, rather than a rule about serializing a request.
   *
   * Those are worth probing, because a validator handed a document that breaks
   * a MUST has to do something and the specification does not say what. But
   * they are indistinguishable from an ordinary case unless the corpus says so,
   * and a document that is invalid by accident looks exactly the same as one
   * that is invalid on purpose. The declaration is checked in both directions:
   * a case claiming this must fail the meta-schema, and a case not claiming it
   * must pass.
   */
  readonly breaksDocumentRule?: {
    readonly citation: Citation;
    readonly detail: string;
    /**
     * Whether the OpenAPI meta-schema can see the breakage.
     *
     * Not every rule addressed to a document author is expressible as a schema.
     * "The map MUST only contain one entry" is; "templated paths with the same
     * hierarchy but different templated names MUST NOT exist" is prose about a
     * relationship between two keys, and a document breaking it validates
     * cleanly. Recording which is which keeps the gate two-sided for both kinds,
     * and incidentally publishes something true: how much of the specification's
     * document rules the meta-schema actually enforces.
     */
    readonly detectedByMetaSchema: boolean;
  };
}

/** The specification settles this one. Pass or fail is attributable. */
export interface ConformanceCase extends CaseBase {
  readonly tier: "conformance";
  /**
   * Every rule the expected verdict rests on, quoted.
   *
   * A list rather than one citation, because the rules compose. Rejecting a
   * foreign parameter name rests on three separate statements: that style
   * determines the serialization, that the serialization of this parameter
   * carries this name, and that a required parameter must be present. One quote
   * covering one of the three reads as attributable and is not, which is the
   * blur this project cannot afford. The type requires at least one, and
   * citation.test.ts requires each to be populated.
   */
  readonly citations: readonly [Citation, ...Citation[]];
  readonly expected: ExpectedVerdict;
  /**
   * The values the specification settles, where it settles them. The Style
   * Examples table gives an exact serialization for each style, explode and
   * type, so for those cases the deserialized value is as settled as the
   * verdict.
   *
   * Asserting the verdict alone is not enough, and this field exists because of
   * a measured case: one library accepts a canonical matrix array and hands the
   * application the raw path segment, semicolons included. Its verdict is
   * right and its value is wrong, and a verdict-only assertion would score that
   * as a pass and flatter it.
   *
   * `null` where the specification settles the verdict but not a value.
   * Libraries that expose no values are scored on the verdict alone and are
   * reported as such, rather than being failed for a capability they do not
   * claim.
   */
  readonly expectedValues: Readonly<Record<string, JsonValue>> | null;
  readonly rationale: string;
}

/**
 * The specification does not settle this one. Implementations may differ, and
 * the difference is the finding.
 *
 * There is deliberately no `expected` field on this type. The brief says to
 * resist the pull toward storing an oracle for divergence cases, and the way to
 * resist a pull is to remove the place it would go rather than to write a rule
 * against filling it in.
 */
export interface DivergenceCase extends CaseBase {
  readonly tier: "divergence";
  /** What the disagreement is about, phrased as an open question. */
  readonly question: string;
  /**
   * Specification text showing the question is left open, where such text
   * exists: a combination marked undefined, or a conversion the specification
   * explicitly leaves implementation-defined.
   *
   * This is not an oracle. It cites the specification declining to settle the
   * question, which is the opposite of an expected answer, and it is what
   * separates a real divergence from a conformance case nobody has written the
   * citation for yet. `null` where the specification is simply silent.
   */
  readonly basis: Citation | null;
}

export type Case = ConformanceCase | DivergenceCase;
