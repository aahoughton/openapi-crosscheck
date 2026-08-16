import type { JsonValue } from "../types/json";
import type {
  OasVersion,
  OpenApiDocument,
  ParameterLocation,
  ParameterObject,
} from "../types/openapi";
import { OAS_VERSIONS } from "../types/openapi";
import type { PipelineStage, SplittableLocation } from "../types/pipeline";
import type { WireRequest } from "../types/wire";

/**
 * Two-sided probes for the stages an adapter declares.
 *
 * A declaration is a claim, and a claim nobody can check is not a measurement.
 * These are what check them: for each stage, one input a library owning that
 * stage must accept and one it must reject, differing only in the dimension
 * that stage governs.
 *
 * Two-sidedness is load-bearing. A library that ignores an input it does not
 * understand accepts everything, so accepting the valid side proves nothing on
 * its own. Accepting the valid side and rejecting the invalid one is evidence
 * that something read the dimension under probe.
 *
 * It remains evidence rather than proof. A library can reject the invalid side
 * for an unrelated reason of its own, which is why a disclaimed stage with
 * contradicting evidence is published for a reader to judge rather than failed
 * by the gate. The asymmetry is deliberate: a stage a library declares and
 * cannot demonstrate is a false statement in an artifact, and that does fail.
 *
 * These are not corpus cases. They carry no citation, no tier and no expected
 * verdict for the corpus to score, they answer no question about the
 * specification, and they never appear in `corpus.json`. They are the harness
 * checking its own inputs.
 */

/** What the two sides differ in, and what a stage owner does with each. */
export interface CapabilityProbe {
  readonly id: string;
  readonly stage: PipelineStage;
  /** Set for splitting, which is claimed per location rather than wholesale. */
  readonly location: SplittableLocation | null;
  /** What the two sides differ in, for the report to print next to the result. */
  readonly asks: string;
  /**
   * What the harness supplies before the library sees the request.
   *
   * `withoutProbedLocation` is what makes a splitting claim checkable: the
   * usual delegated split, minus the one location under probe. A library that
   * recovers that location itself still answers, and one that was relying on
   * the harness cannot.
   *
   * Supplying nothing at all would measure the wrong thing. One library in
   * the roster parses the `Cookie` header itself, from a headers record the
   * harness folds for it because it delegates header splitting. Withholding
   * everything would withhold the headers too, and the probe would read "does
   * not split cookies" where the truth is "splits cookies, out of a record we
   * hand it". The counterfactual has to change one location.
   *
   * `withProbedLocation` is the other half of the pair, and it forces the
   * location on rather than leaving it to the declaration. Forcing it is what
   * gives the pair meaning: `delegatedSplits` already returns false for a
   * location the library claims, so "the usual split" and "the usual split
   * minus this location" would be byte-identical inputs for every claimed
   * location, and the refutation below could never fire.
   *
   * With the location forced on, the two sides mean something: a library that
   * answers when handed the split and fails without it has been shown to
   * delegate the location it claims. It also probes the protocol rule that a
   * container must not read a location it declared it owns.
   */
  readonly supply: "asDeclared" | "withProbedLocation" | "withoutProbedLocation";
  readonly document: OpenApiDocument;
  /** A library owning this stage accepts this. */
  readonly accept: WireRequest;
  /** A library owning this stage rejects this. */
  readonly reject: WireRequest;
}

/**
 * The `openapi` value each probe's document carries: the newest published
 * patch of each line at the time this file was written. Version claims are
 * about a minor line (3.1 means 3.1.x documents), and the citations pin exact
 * patch revisions where exactness matters.
 *
 * Every probe document in this file comes from here, including the ones that
 * ask nothing about versions. A stage probe carrying a different patch than
 * the version probe next to it would be a second answer to a question this
 * table already answers.
 */
const PROBE_DOCUMENT_VERSIONS: Readonly<Record<OasVersion, string>> = {
  "3.0": "3.0.4",
  "3.1": "3.1.1",
  "3.2": "3.2.0",
};

const BLUE_ONLY: JsonValue = { type: "string", enum: ["blue"] };
const BLUE_ONLY_DEFAULT: JsonValue = { type: "string", enum: ["blue"], default: "blue" };
const BLUE_BLACK_ARRAY: JsonValue = {
  type: "array",
  items: { type: "string", enum: ["blue", "black"] },
};
const R_OBJECT: JsonValue = {
  type: "object",
  properties: { R: { type: "string" } },
  required: ["R"],
};

/**
 * An enum of one rather than a type mismatch, on purpose.
 *
 * The invalid side has to be invalid for every library in the same way. A
 * string against `type: integer` is not: whether `"7"` is an integer depends on
 * whether the library coerces non-body parameters, which is a real difference
 * between libraries and would make this probe measure coercion policy while
 * claiming to measure splitting. Both sides here are strings, and one of them
 * is not in the enumeration.
 */
function document(parameters: readonly ParameterObject[], template: string): OpenApiDocument {
  return {
    openapi: PROBE_DOCUMENT_VERSIONS["3.1"],
    info: { title: "capability probe", version: "1" },
    paths: {
      [template]: {
        get: { operationId: "probe", parameters, responses: { "200": { description: "ok" } } },
      },
    },
  };
}

function request(
  target: string,
  headers: ReadonlyArray<readonly [string, string]> = [],
): WireRequest {
  return { method: "GET", target, headers: [["Host", "harness.invalid"], ...headers] };
}

/**
 * The canonical declaration: style and explode left to their defaults.
 *
 * Writing `explode: false` on a scalar was the second confound. It is legal and
 * it is not the default, and a library reading it took the value down a
 * different path than the one every corpus scalar case takes. A probe about
 * recovering a value has to hold serialization canonical, or it measures both
 * and reports one.
 */
/** The declared parameter, optional, for the probe about what fills its absence. */
function optionalParameter(location: ParameterLocation, schema: JsonValue): ParameterObject {
  return { ...parameter(location, schema), required: false };
}

function parameter(location: ParameterLocation, schema: JsonValue): ParameterObject {
  return { name: "p", in: location, required: true, schema };
}

/** Where a value for `p` is written, per location, and what carries it. */
function inLocation(location: SplittableLocation, value: string): WireRequest {
  if (location === "path") return request(`/t/${value}`);
  if (location === "query") return request(`/t?p=${value}`);
  if (location === "header") return request("/t", [["p", value]]);
  return request("/t", [["Cookie", `p=${value}`]]);
}

function splittingProbes(): readonly CapabilityProbe[] {
  const locations: readonly SplittableLocation[] = ["cookie", "header", "path", "query"];
  const supplies: readonly ("withProbedLocation" | "withoutProbedLocation")[] = [
    "withoutProbedLocation",
    "withProbedLocation",
  ];
  return locations.flatMap((location) =>
    supplies.map((supply) => ({
      id: `splitting-${location}-${supply}`,
      stage: "splitting" as const,
      location,
      asks:
        `whether a declared ${location} parameter's value is recovered, with the harness ` +
        (supply === "withoutProbedLocation"
          ? `supplying its usual split for every location except ${location}`
          : `supplying the ${location} split itself`),
      supply,
      document: document([parameter(location, BLUE_ONLY)], location === "path" ? "/t/{p}" : "/t"),
      accept: inLocation(location, "blue"),
      reject: inLocation(location, "red"),
    })),
  );
}

/**
 * Style deserialization, probed in the three locations a comma-joined array is
 * legal in.
 *
 * One location would not be enough, and the reason is worth recording: a
 * library can apply styles where it splits for itself and treat a location the
 * harness hands it as something else. One in the roster demonstrates the stage
 * on query and shows nothing on header or path, which a single probe would
 * have rendered as a plain yes or a plain no depending which one it was.
 * Running all three and publishing all three states it.
 */
function styleProbes(): readonly CapabilityProbe[] {
  const locations: readonly ParameterLocation[] = ["header", "path", "query"];
  return locations.map((location) => ({
    id: `style-deserialization-array-${location}`,
    stage: "styleDeserialization" as const,
    location: null,
    asks: `whether a comma-joined ${location} array is split before its members are judged`,
    supply: "asDeclared" as const,
    // Style and explode are written out here, where the splitting probes leave
    // them at their defaults. The stage under probe is the one that reads them,
    // and the default for a query array is explode, whose wire form is
    // `p=blue&p=black` rather than the comma form. Leaving them out and writing
    // commas asked for one serialization and declared another, and libraries
    // that rejected it were reading the declaration correctly.
    document: document(
      [
        {
          name: "p",
          in: location,
          required: true,
          style: location === "query" ? "form" : "simple",
          explode: false,
          schema: BLUE_BLACK_ARRAY,
        },
      ],
      location === "path" ? "/t/{p}" : "/t",
    ),
    accept: inLocation(location, "blue,black"),
    reject: inLocation(location, "blue,red"),
  }));
}

export const CAPABILITY_PROBES: readonly CapabilityProbe[] = [
  {
    id: "routing-method",
    stage: "routing",
    location: null,
    // The two sides carry the same well-formed value in the same place, so the
    // only thing left to answer them differently is which operation the request
    // is for. A library told its operation by the harness never looks at the
    // method and accepts both.
    asks: "whether a request for an undeclared method reaches an operation at all",
    supply: "asDeclared",
    document: document([parameter("path", BLUE_ONLY)], "/t/{p}"),
    accept: request("/t/blue"),
    reject: { method: "POST", target: "/t/blue", headers: [["Host", "harness.invalid"]] },
  },
  ...splittingProbes(),
  // A library applying no style sees one string where the schema wants an
  // array, and rejects both sides. One that applies the location's default
  // style splits on the comma and then judges the members.
  ...styleProbes(),
  {
    id: "content-deserialization-json-object",
    stage: "contentDeserialization",
    location: null,
    // A library that never reads the value as its declared media type accepts
    // both sides, because to it they are two strings it has no rule about.
    asks: "whether a content parameter's value is read as its declared media type",
    supply: "asDeclared",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          content: { "application/json": { schema: R_OBJECT } },
        },
      ],
      "/t",
    ),
    accept: request("/t?p=%7B%22R%22%3A%22100%22%7D"),
    reject: request("/t?p=%7Bnot-json"),
  },
  {
    stage: "schemaValidation",
    id: "schema-validation-enum",
    location: null,
    asks: "whether a recovered value is judged against its schema",
    supply: "asDeclared",
    document: document([parameter("path", BLUE_ONLY)], "/t/{p}"),
    accept: request("/t/blue"),
    reject: request("/t/red"),
  },
  {
    id: "value-exposure-accepted",
    stage: "valueExposure",
    location: null,
    // The only probe whose reading is not the pair of verdicts. Exposure is
    // read from the accepted side's observation: a library claiming it must
    // have produced a value for the parameter it just accepted.
    asks: "whether the deserialized value of an accepted parameter is handed back",
    supply: "asDeclared",
    document: document([parameter("path", BLUE_ONLY)], "/t/{p}"),
    accept: request("/t/blue"),
    reject: request("/t/red"),
  },
  {
    id: "value-exposure-write-back",
    stage: "valueExposure",
    location: null,
    // The channel the ordinary exposure probe cannot see. A library with no
    // value-returning call can still write values onto the input it was
    // handed, which is a value channel whatever the published API returns,
    // and it fires where there is something to write that the wire did not
    // carry: an absent optional parameter whose schema names a default. A
    // return-channel library that reports the default demonstrates here too;
    // a library that leaves absent parameters absent shows nothing here and
    // demonstrates on the ordinary probe instead.
    asks: "whether a value the library supplied for an absent optional parameter reaches the caller",
    supply: "asDeclared",
    document: document([optionalParameter("query", BLUE_ONLY_DEFAULT)], "/t"),
    accept: request("/t"),
    reject: request("/t?p=green"),
  },
];

/**
 * A two-sided probe of one specification version's support claim.
 *
 * The document is the version's most ordinary citizen: one required query
 * string against an enumeration, expressible identically in every version the
 * protocol knows, so the only thing the probe varies across versions is the
 * `openapi` field itself. The two sides differ in whether the value is in the
 * enumeration, the same shape as the schema probe, because a version claim is
 * only observable through the library doing something with a document of that
 * version.
 *
 * Like every probe, this demonstrates and never refutes. A library that
 * rejects the valid side may not read the version, or may be strict about
 * something else entirely; telling those apart would need reading an absence.
 * A declared version no probe showed is published as an unbacked claim, and a
 * disclaimed version is probed anyway with what the probe saw published.
 */
export interface VersionProbe {
  readonly probeId: string;
  readonly oasVersion: OasVersion;
  readonly asks: string;
  readonly document: OpenApiDocument;
  readonly accept: WireRequest;
  readonly reject: WireRequest;
}

export const VERSION_PROBES: readonly VersionProbe[] = OAS_VERSIONS.map((oasVersion) => ({
  probeId: `oas-${oasVersion}-document`,
  oasVersion,
  asks:
    `whether the library accepts a valid request against an ordinary OpenAPI ` +
    `${oasVersion} document and rejects a value outside its enumeration`,
  document: {
    ...document([parameter("query", BLUE_ONLY)], "/t"),
    openapi: PROBE_DOCUMENT_VERSIONS[oasVersion],
  },
  accept: request("/t?p=blue"),
  reject: request("/t?p=green"),
}));
