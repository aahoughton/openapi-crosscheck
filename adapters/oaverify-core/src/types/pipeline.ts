import type { ParameterLocation } from "./openapi";
import type { Dimensions } from "./case";

/**
 * The request-validation pipeline, named stage by stage.
 *
 * A library is not one thing that either works or does not. It owns some prefix
 * or subset of these stages and leaves the rest to its caller, and which ones it
 * leaves is the difference between the two questions this repository answers:
 *
 * - Fed at the boundary it accepts, does it read the specification correctly?
 * - Can it be handed an HTTP request and produce a verdict you can trust?
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
 */
export type DeserializationStage = "contentDeserialization" | "styleDeserialization";

/** Which of the two applies to a parameter, from how it was declared. */
export function deserializationStage(declaration: "content" | "schema"): DeserializationStage {
  return declaration === "content" ? "contentDeserialization" : "styleDeserialization";
}

/**
 * Which locations splitting is a question for.
 *
 * Written out rather than aliased to `ParameterLocation`. Splitting is claimed
 * per location and `querystring` is not one of the locations it is a question
 * for, so the two sets are not the same set: aliasing them would turn the fifth
 * parameter location into a fifth `splitting` key the protocol does not have.
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
 * `splitting` is per location because that is where the model broke: a library
 * can extract path parameters from a raw target and still refuse to split a
 * query string, and calling that "takes a request" or "does not" is wrong in
 * both directions.
 *
 * Every field is a claim, and every claim is falsifiable. Each is backed by a
 * test demonstrating it, because a declaration nobody can check is not a
 * measurement.
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
    // `querystring` is not a location splitting is a question for: the value is
    // the whole query string, so nothing is matched against a declared name and
    // no container declares ownership of it. Answering either way would decide
    // who owns work nobody does, so this says so instead of guessing.
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
 */
export function canBeAsked(ownership: StageOwnership, dimensions: Dimensions): boolean {
  const probed = probedStage(dimensions);
  const { location } = dimensions;
  // No splitting step for a querystring parameter: its value is everything
  // after the first `?`, so nothing is matched against a declared name. Kept in
  // step with the harness, whose `ownsStage` refuses to answer for that
  // location; leaving splitting in the chain here would reach that refusal.
  const order: readonly PipelineStage[] = [
    "routing",
    ...(location === "querystring" ? [] : (["splitting"] as const)),
    deserializationStage(dimensions.declaration),
    "schemaValidation",
  ];
  const from = order.indexOf(probed);
  if (from === -1) return ownsStage(ownership, probed, location);
  const required = order.slice(from);

  // A `content` parameter needs its representation parsed whatever the case
  // probes, including a case probing the schema.
  //
  // The asymmetry is in what the harness supplies. Preparse splits, and hands
  // over raw text; it never deserializes, because deserializing downstream of
  // the probe would grade the harness's own work. For a `schema` parameter that
  // raw text is often already the value the schema sees, so a library owning
  // schema validation alone can answer a wrong-typed scalar and does. For a
  // `content` parameter it never is: the schema is written against the parsed
  // representation, and the parsed representation of `{"R":"100"}` is not the
  // eleven characters of it. So a schema-only library handed that string is not
  // answering the question the case asks.
  //
  // Applied to every content case, including one probing a missing name, where
  // no value needs parsing and the conservatism costs an answer a schema-only
  // library could give. No such case exists yet. Writing one is the moment to
  // narrow this, and narrowing it means saying what the harness hands over for
  // an absent parameter, rather than assuming.
  if (dimensions.declaration === "content" && !required.includes("contentDeserialization")) {
    return (
      ownsStage(ownership, "contentDeserialization", location) &&
      required.every((stage) => ownsStage(ownership, stage, location))
    );
  }
  return required.every((stage) => ownsStage(ownership, stage, location));
}

/**
 * Which stage a case probes, from the axis it varies and the location it varies
 * it in.
 *
 * A rule rather than a hand-written label on each case. A label is a judgement
 * per case, and forty-five judgements drift; a rule can be stated, argued with,
 * and applied the same way to a case written next year. It also cannot disagree
 * with itself, which a field sitting next to `probeAxis` eventually would.
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
  // required check and the schema. Both are answerable by a library that was
  // handed an already-split request, so both stay askable of one.
  //
  // Wrong-typedness is a value that deserialized cleanly and is well-formed for
  // some other type. A value the declared serialization cannot read at all does
  // not reach the schema, and carries `foreignWireShape` instead.
  if (probeAxis === "missingName" || probeAxis === "wrongTypeValue") return "schemaValidation";

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

  // A flag that changes how a value is read is a question about the reading,
  // even when the flag is spelled elsewhere in the declaration.
  if (probeAxis === "declarationFlag") return deserialization;

  // Elsewhere the name and the value are recovered before style is applied, so
  // anything varying the identifier is a question about that recovery.
  if (
    probeAxis === "caseVariant" ||
    probeAxis === "competingParameter" ||
    probeAxis === "duplicateName" ||
    probeAxis === "encodingVariant" ||
    probeAxis === "foreignName"
  ) {
    return "splitting";
  }

  // canonical, emptyAfterParse, emptyContainer, foreignWireShape: the name is
  // the declared one and was recovered, and what is under test is what its raw
  // value deserializes to. Which mechanism does that reading is the parameter's
  // own declaration, so a malformed `application/json` value is a content
  // question and a foreign style shape is a style question.
  return deserialization;
}
