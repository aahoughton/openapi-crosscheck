import type { ParameterLocation } from "./openapi";
import type { Dimensions, SchemaShape } from "./case";
import type { Style } from "./openapi";
import type { QueryPairInput } from "./adapter";

/**
 * The shapes whose value is assembled rather than read. A scalar's value is the
 * text preparse already handed over; an object's or an array's is built out of
 * several pieces of that text by whichever deserialization the declaration
 * names.
 */
const STRUCTURED_SHAPES: ReadonlySet<SchemaShape> = new Set([
  "array",
  "nullableArray",
  "nullableObject",
  "object",
]);

/**
 * The styles that write the parameter's name into the wire form around its
 * value, so the raw text preparse hands over is never the value itself.
 *
 * `;p=blue` and `.blue` are a path segment each, and getting `blue` out of
 * either means reading the style. Every other style in the surface leaves the
 * value where a naive split already puts it: `form` puts it after the `=` that
 * preparse splits on, and `simple` writes the segment as the value.
 */
const NAME_CARRYING_STYLES: ReadonlySet<Style> = new Set<Style>(["label", "matrix"]);

/**
 * The request-validation pipeline, named stage by stage.
 *
 * A library is not one thing that either works or does not. It owns some prefix
 * or subset of these stages and leaves the rest to its caller, and which ones it
 * leaves is the difference between the two questions this repository answers:
 *
 * - Fed at the boundary it accepts, does it read the specification correctly?
 * - Can it be handed an HTTP request and produce a verdict at that boundary?
 *
 * The first tolerates the harness doing upstream work, provided that work is
 * recorded and identical for every library that needs it. The second is a
 * question about coverage, and every stage a library delegates is a stage its
 * caller implements, where the resulting bugs belong to the caller.
 */
export type PipelineStage =
  /** Match method and target to an operation. */
  | "routing"
  /** Recover each parameter's raw wire value from the target or the headers. */
  | "splitting"
  /** Apply `style` and `explode` to a raw value to produce a structured one. */
  | "styleDeserialization"
  /** Read a raw value as a representation of the declared media type. */
  | "contentDeserialization"
  /** Coerce to the declared type and validate against the schema. */
  | "schemaValidation"
  /** Hand the deserialized values back to the caller. */
  | "valueExposure";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "routing",
  "splitting",
  "styleDeserialization",
  "contentDeserialization",
  "schemaValidation",
  "valueExposure",
];

/**
 * The two stages that turn a raw wire value into a structured one, and the
 * reason there are two of them.
 *
 * The specification defines exactly two ways a parameter's serialization is
 * specified, and requires each parameter to use one: "Parameter Objects MUST
 * include either a content field or a schema field, but not both." So these are
 * siblings occupying one position in the pipeline rather than a sequence. A
 * request never passes through both for the same parameter, and a library
 * owning one has said nothing about the other.
 *
 * One stage could not describe a library that applies styles and never parses
 * a media type: `content: application/json` has no `style` and no `explode`,
 * so such a library would have to either claim parsing it does not do or
 * disclaim style deserialization it demonstrably performs.
 */
export type DeserializationStage = "contentDeserialization" | "styleDeserialization";

/** Which of the two applies to a parameter, from how it was declared. */
export function deserializationStage(declaration: "content" | "schema"): DeserializationStage {
  return declaration === "content" ? "contentDeserialization" : "styleDeserialization";
}

/**
 * Which locations splitting is a question for.
 *
 * Headers are included. A header arrives as a name and a value, but matching a
 * declared name against the ones received is still work, and a library whose
 * published input is a record keyed by lowercased name never does it: whoever
 * built that record folded the casing and collected the duplicates. Both are
 * probe dimensions, so the folding is attributed to whoever performed it.
 *
 * Written out rather than aliased to `ParameterLocation`, so a location joins
 * this set by a decision rather than by arriving in the parameter union
 * (`querystring` is a parameter location with nothing to split). A location
 * added here has to be added to `SPLITTABLE_LOCATIONS`, `delegatedSplits()`
 * and every container's declaration, and the compiler says so at each one.
 */
export type SplittableLocation = "cookie" | "header" | "path" | "query";

export const SPLITTABLE_LOCATIONS: readonly SplittableLocation[] = [
  "cookie",
  "header",
  "path",
  "query",
];

/**
 * What a library does for itself, stage by stage.
 *
 * `splitting` is per location: a library can extract path parameters from a
 * raw target and still leave the query string to its caller.
 *
 * Every field is a claim, probed two-sidedly by `src/capability/probes.ts` and
 * published with what the probe saw.
 */
export interface StageOwnership {
  readonly routing: boolean;
  readonly splitting: Readonly<Record<SplittableLocation, boolean>>;
  readonly styleDeserialization: boolean;
  /**
   * Whether the library reads a `content` parameter's value as a representation
   * of its declared media type.
   *
   * Separate from `styleDeserialization` because the two are sibling mechanisms
   * rather than one stage, and because a single boolean covering both cannot be
   * true of a library that does one and not the other. A library declaring
   * `false` here is still asked every `schema` case; it is asked no `content`
   * case, and `capabilities.md` publishes what the evidence probe saw when it
   * ran the stage against it anyway.
   */
  readonly contentDeserialization: boolean;
  readonly schemaValidation: boolean;
  readonly valueExposure: boolean;
}

/**
 * Whether a library owns the stage a case is probing, for the location it
 * probes it in.
 *
 * This is the guard the runner applies. A library is asked a case when it owns
 * the stage that case exists to probe, whatever the harness had to do upstream
 * to get the request that far. Asking on any looser rule would attribute the
 * harness's own work to a library; asking on any stricter one discards answers
 * a library demonstrably gives.
 */
export function ownsStage(
  ownership: StageOwnership,
  stage: PipelineStage,
  location: ParameterLocation,
): boolean {
  if (stage === "splitting") {
    // Splitting is claimed per location, and `querystring` is not one of the
    // locations it is a question for: the value is the whole query string, so
    // there is nothing to match a declared name against. No container declares
    // it, so there is no answer to read, and inventing one in either direction
    // would decide who owns work nobody does. The stage order in `canBeAsked`
    // leaves splitting out of every querystring chain, which makes this
    // unreachable; it throws rather than guessing so that a caller that finds a
    // way here says so.
    if (location === "querystring") {
      throw new Error(
        "splitting ownership is not claimed for querystring: the parameter's value is the " +
          "whole query string, so no location is split to produce it",
      );
    }
    return ownership.splitting[location];
  }
  if (stage === "routing") return ownership.routing;
  if (stage === "styleDeserialization") return ownership.styleDeserialization;
  if (stage === "contentDeserialization") return ownership.contentDeserialization;
  if (stage === "schemaValidation") return ownership.schemaValidation;
  return ownership.valueExposure;
}

/**
 * Whether a library can be asked a case at all: it owns the stage the case
 * probes, and every stage between that one and the verdict.
 *
 * The asymmetry is the point. The harness can fill in stages *upstream* of the
 * probe, because that fill-in is one implementation applied identically to
 * every library that needs it, and it is recorded on the cell. It can never
 * fill in stages *downstream*, because those are what produce the verdict and
 * they are the thing under measurement: a harness that deserialized a style or
 * validated a schema on a library's behalf would be grading its own work.
 *
 * So a library owning only schema validation can answer a case probing the
 * required check, and cannot answer one probing a header name match, even
 * though the harness could hand it the split. Reaching a verdict for that case
 * would need the style deserialization it does not do.
 *
 * `valueExposure` is not required. A verdict does not need values, and a case
 * that also checks values scores the value half separately.
 *
 * The chain a case has to travel depends on how its parameter was declared,
 * because the two deserialization stages are siblings rather than a sequence.
 * A `schema` case passes through style deserialization and never through
 * content, and a `content` case the other way round. Taking the dimensions
 * rather than a bare stage is what lets that be read off the case instead of
 * guessed.
 *
 * `target` is the case's wire target, read by the one guard that depends on
 * what the wire carries rather than on what the declaration says:
 * `withheldOverQueryDecoding` below.
 */
export function canBeAsked(
  ownership: StageOwnership,
  dimensions: Dimensions,
  target: string,
  queryPairInput: QueryPairInput,
): boolean {
  return (
    ownsCaseChain(ownership, dimensions) &&
    !withheldOverQueryDecoding(ownership, dimensions, target, queryPairInput)
  );
}

/** Owns the probed stage and every stage between it and the verdict. */
function ownsCaseChain(ownership: StageOwnership, dimensions: Dimensions): boolean {
  const probed = probedStage(dimensions);
  const { location } = dimensions;
  // The chain a querystring parameter travels has no splitting step in it. Its
  // value is everything after the first `?`, so nothing is matched against a
  // declared name and no library is asked to have done that. Leaving splitting
  // in the chain would make a querystring case unaskable of any library that
  // disclaims a split it is never asked to perform, which is a stage-ownership
  // claim about one location deciding a case in another.
  const order: readonly PipelineStage[] = [
    "routing",
    ...(location === "querystring" ? [] : (["splitting"] as const)),
    deserializationStage(dimensions.declaration),
    "schemaValidation",
  ];
  const from = order.indexOf(probed);
  if (from === -1) return ownsStage(ownership, probed, location);
  const required = order.slice(from);

  // The deserialization stage is required, whatever the case probes, in the
  // three situations where the raw text preparse hands over is not the value
  // the schema sees:
  //
  // - A `content` parameter. The schema is written against the parsed
  //   representation, so a schema-only library handed `{"R":"100"}` as eleven
  //   characters is not answering the case's question. This also withholds a
  //   content case probing absence, where no value needs parsing; no such case
  //   exists, and writing one means stating what the harness hands over for
  //   an absent parameter.
  // - A structured `schema` parameter probed on a wrong-typed value.
  //   `R=blue&G=200` is two pairs, and a library that never assembles `p`
  //   rejects because `p` is missing, which would score as catching the wrong
  //   type. Probed on absence it is still askable: an empty query is noticed
  //   or not for the reason the case is about.
  // - A style that writes the name into the wire form (`label`, `matrix`).
  //   `;p=42` rejected as a non-integer is the style syntax being rejected.
  const deserialization = deserializationStage(dimensions.declaration);
  const needsDeserialization =
    dimensions.declaration === "content" ||
    (dimensions.declaration === "schema" && NAME_CARRYING_STYLES.has(dimensions.style)) ||
    (dimensions.probeAxis === "wrongTypeValue" && STRUCTURED_SHAPES.has(dimensions.schema));
  const stages =
    needsDeserialization && !required.includes(deserialization)
      ? [deserialization, ...required]
      : required;
  return stages.every((stage) => ownsStage(ownership, stage, location));
}

/**
 * The fourth way the text preparse hands over is not the text the case's
 * question is about, and the only one read off the wire rather than the
 * declaration: a query value carrying a percent triple or a `+`.
 *
 * This guard states a harness limitation. Preparse hands query pairs through
 * raw, and it cannot do otherwise: whether `+` means a space, and whether a
 * percent triple comes off before or after a delimiter is read, are questions
 * cases in this corpus exist to ask, so a preparse that decoded would answer
 * them on every library's behalf. The raw hand-off is the most the harness can
 * supply without grading its own work.
 *
 * The adapter declares the public query-pair contract separately from query
 * splitting. `notUsed` means the library reads the target and performs its own
 * split. `raw` means the public input accepts the pairs preparse produces.
 * `decoded` means percent triples have already been resolved before the
 * library sees them. Raw text is outside that third contract, so grading the
 * library on it measures the hand-off: a deserializer echoing `a%2Bb` where
 * its caller supplies `a+b` is the cell this guard exists to withhold.
 *
 * So a query case whose wire text query decoding would convert is not asked
 * of a library whose public input expects decoded pairs. One rule, with a stated cost:
 * a verdict such a library reaches without the decoded value, such as
 * accepting a scalar that is a string in either encoding state, is withheld
 * along with the rest. Whether a particular verdict depended on the decoding
 * is a judgement per cell, and per-cell judgements drift; the withheld cells
 * say the harness could not supply the input, which is the true statement
 * this repository can make for all of them.
 *
 * Query only. The 3.2 cookie rule makes cookie decoding the identity, so a
 * raw cookie pair is exactly what a caller would hand over and the one cookie
 * case carrying a percent triple stays a real measurement. No corpus case
 * carries converted encoding in a header, and path segments reach a
 * disclaiming library only through guards above this one. A case that changes
 * either of those is the moment to widen this, and widening it means citing
 * what that location's decoding converts, rather than assuming.
 */
export function withheldOverQueryDecoding(
  ownership: StageOwnership,
  dimensions: Dimensions,
  target: string,
  queryPairInput: QueryPairInput,
): boolean {
  return (
    dimensions.location === "query" &&
    queryPairInput === "decoded" &&
    ownsCaseChain(ownership, dimensions) &&
    queryCarriesConvertedEncoding(target)
  );
}

/**
 * Whether the query portion of a wire target carries text query decoding
 * converts: a percent triple, or the `+` whose reading is itself contested.
 */
function queryCarriesConvertedEncoding(target: string): boolean {
  const question = target.indexOf("?");
  if (question === -1) return false;
  return /%[0-9A-Fa-f]{2}|\+/.test(target.slice(question + 1));
}

/**
 * Which stage a case probes, from the axis it varies and the location it varies
 * it in.
 *
 * A rule rather than a hand-written label on each case, so it is applied the
 * same way to every case and cannot drift from `probeAxis`.
 *
 * The axis alone is not enough, because the same variation lands on different
 * stages in different locations. In a query, splitting on `&` and `=` produces
 * the name and value pairs first, so a foreign or duplicated name is a question
 * about that splitting. In a path there is no such step: `style` is what encodes
 * the name into the segment at all, so recognising that `;q=blue` carries no `p`
 * requires reading matrix syntax, and the same variation is a style question.
 *
 * Where a rationale in the corpus settles it, the rationale wins. Two do:
 * a missing name asks whether "the presence of some query parameter is the
 * presence of this one", which is the required check rather than the split; and
 * a percent-encoded delimiter in a path asks whether decoding happens before
 * splitting, which is style deserialization by definition.
 */
export function probedStage(dimensions: Dimensions): PipelineStage {
  const { location, probeAxis } = dimensions;
  // Which of the two sibling deserialization stages this parameter travels
  // through. Read from the declaration rather than assumed, because a `content`
  // parameter has no style to apply and a `schema` parameter has no media type
  // to parse.
  const deserialization = deserializationStage(dimensions.declaration);

  // Absence and wrong-typedness are settled after any deserialization, by the
  // required check and the schema. A reserved declaration is settled at the
  // same boundary: a library handed the declaration and an already-split
  // request can decide whether the required and schema checks apply without
  // deserializing a value. A constraint violation is a value that deserialized
  // cleanly and is the declared type, so the only stage left to reject it is
  // the schema. All four stay askable of a schema-only library.
  //
  // A document-rule violation is settled wherever the field the rule forbids is
  // read, and the two fields this axis carries outside `in: "querystring"`,
  // `required` on a path parameter and a 3.0 `type` written as an array, are
  // both read at this boundary: no serialization consults either, and a library
  // handed the declaration and an already-split request can reach a verdict on
  // both. The location is what excludes `in: "querystring"`, whose forbidden
  // fields are the serialization ones and whose rule sits below.
  //
  // Wrong-typedness is a value that deserialized cleanly and is well-formed for
  // some other type. A value the declared serialization cannot read at all does
  // not reach the schema, and carries `foreignWireShape` instead.
  if (
    probeAxis === "constraintViolation" ||
    (probeAxis === "documentRule" && location !== "querystring") ||
    probeAxis === "missingName" ||
    probeAxis === "optionalAbsent" ||
    probeAxis === "reservedName" ||
    probeAxis === "wrongTypeValue"
  ) {
    return "schemaValidation";
  }

  // Which operation the request is for, asked before anything is read out of
  // it. The only axis that reaches the routing stage, and the reason a case
  // carrying it declares more than one path.
  if (probeAxis === "competingPath") return "routing";

  // A path parameter is encoded into its segment by its own serialization, so
  // every question about which text belongs to which parameter is a question
  // about that serialization. Checked after routing, because a path case asking
  // which operation matched is not asking anything about how a segment was
  // written.
  if (location === "path") return deserialization;

  // A querystring parameter's value is the entire query string, so there is no
  // step that recovers an identifier for the identifier axes below to be about.
  // Nothing is matched against a declared name, nothing is split on a
  // delimiter, and the parameter claims every byte after the first `?` whatever
  // else the document says. What a second declaration or a competing `in:
  // "query"` parameter does is settled where the declaration is read, and the
  // reading of a `content` parameter is content deserialization.
  //
  // Stated for the location rather than for each axis, and placed above them
  // for the same reason the path rule is: the axis alone does not say which
  // stage a variation lands on, and the location is what decides it. A
  // document-rule violation is read here too: the fields this location may not
  // carry are the serialization ones, so which stage settles the violation is
  // the one that reads them.
  if (location === "querystring") return deserialization;

  // A flag that changes how a value is read is a question about the reading,
  // even when the flag is spelled elsewhere in the declaration. An encoding
  // variant is also a question about that reading: splitting recovers the raw
  // value and deliberately leaves percent triples and `+` unchanged for the
  // parameter's deserializer to interpret.
  if (probeAxis === "declarationFlag" || probeAxis === "encodingVariant") {
    return deserialization;
  }

  // Elsewhere the name and the value are recovered before style is applied, so
  // anything varying the identifier is a question about that recovery.
  if (
    probeAxis === "caseVariant" ||
    probeAxis === "competingParameter" ||
    probeAxis === "duplicateName" ||
    probeAxis === "foreignName"
  ) {
    return "splitting";
  }

  // canonical, emptyAfterParse, emptyContainer, foreignWireShape,
  // nameWithoutValue: the name is the declared one and was recovered, and what
  // is under test is what its raw value deserializes to. A name that arrived
  // with no `=` was recovered as much as one that arrived with an empty value;
  // what parts them is what each is read as, which is this stage. Which
  // mechanism does that reading is the parameter's own declaration, so a
  // malformed `application/json` value is a content question and a foreign
  // style shape is a style question.
  return deserialization;
}
