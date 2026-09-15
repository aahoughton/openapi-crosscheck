import type { Case, Citation } from "../../../types/case";
import { MIXED_OBJECT, REQUIRED_STRING_OBJECT, STRING_OBJECT, document, request } from "./build";
// The 3.1 builder, for the one document here that is deliberately not a 3.2
// document: the check that the older meta-schemas refuse this location.
import { documentBuilders } from "../../build";
import * as cite from "../../citations/oas32";

/**
 * OpenAPI 3.2's `querystring` location reads the entire query string using a
 * `content` declaration. Four cases use invalid documents, whose handling is
 * unspecified, and therefore record divergence.
 *
 * Negative requests exercise both malformed JSON and a form-urlencoded value
 * outside its schema. The JSON pair shares one document, so rejecting both
 * sides shows no evidence of distinguishing a valid representation from an
 * invalid one. A verdict alone does not identify the cause of rejection.
 */

const SPEC = "https://spec.openapis.org/oas/v3.2.0.html";

function cite32(anchor: string, quoted: string): Citation {
  return { oasVersion: "3.2", anchor, url: `${SPEC}#${anchor}`, quoted };
}

/**
 * The full querystring bullet from Section 4.12.1, preserving its four rules
 * and suggested media type together. Quoted specification text retains its
 * original punctuation, including the typographic apostrophe.
 */
const PARAMETER_LOCATIONS_QUERYSTRING = cite32(
  "parameter-locations",
  "querystring - A parameter that treats the entire URL query string as a value which " +
    "MUST be specified using the content field, most often with media type " +
    "application/x-www-form-urlencoded using Encoding Objects in the same way as with " +
    "request bodies of that media type; MUST NOT appear more than once, and MUST NOT " +
    "appear in the same operation (or in the operation’s path-item) as any " +
    'in: "query" parameters.',
);

/**
 * The query bullet also forbids combining the locations. The mixed-location
 * case cites both statements.
 */
const PARAMETER_LOCATIONS_QUERY = cite32(
  "parameter-locations",
  "query - Parameters that are appended to the URL. For example, in /items?id=###, the " +
    "query parameter is id; MUST NOT appear in the same operation (or in the " +
    'operation’s path-item) as an in: "querystring" parameter.',
);

/** The fields a querystring parameter may not carry, which is why `schema` is out. */
const FIXED_FIELDS_FOR_USE_WITH_SCHEMA = cite32(
  "fixed-fields-for-use-with-schema",
  "For simpler scenarios, a schema and style can describe the structure and syntax of " +
    'the parameter. These fields MUST NOT be used with in: "querystring".',
);

/** The media type the specification pairs with the location, said a second time. */
const FIXED_FIELDS_FOR_USE_WITH_CONTENT = cite32(
  "fixed-fields-for-use-with-content",
  "For more complex scenarios, the content field can define the media type and schema of " +
    "the parameter, as well as give examples of its use. For use with " +
    'in: "querystring" and application/x-www-form-urlencoded, see Encoding the ' +
    "x-www-form-urlencoded Media Type.",
);

const FORM_URLENCODED = "application/x-www-form-urlencoded";

export const querystringCases32: readonly Case[] = [
  {
    id: "querystring-form-urlencoded-object-canonical-oas32",
    title: "querystring, x-www-form-urlencoded, object, canonical",
    inShort:
      "The whole query string read as one form-urlencoded value. The positive control, and the media type the specification pairs with this location.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      PARAMETER_LOCATIONS_QUERYSTRING,
      FIXED_FIELDS_FOR_USE_WITH_CONTENT,
      cite.PARAMETER_REQUIRED,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The parameter's value is the entire query string, and `R=100&G=200` is that string read as the media type it declares. Both properties are present and both are strings, which is what the schema asks for.",
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          content: { [FORM_URLENCODED]: { schema: REQUIRED_STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [
      "the media type is the one the specification pairs with this location",
      "the query string is well-formed for it",
      "exactly one parameter is declared",
      "canonical encoding",
    ],
  },
  ...[true, false].map((valid): Case => ({
    id: `querystring-json-object-${valid ? "canonical" : "malformed"}-oas32`,
    title: `querystring, application/json, object, ${valid ? "percent-encoded" : "malformed"}`,
    inShort: valid
      ? "The whole query string carries percent-encoded JSON. Decode it before parsing the object."
      : "The whole query string decodes to malformed JSON. The companion valid request uses the same document.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      PARAMETER_LOCATIONS_QUERYSTRING,
      FIXED_FIELDS_FOR_USE_WITH_CONTENT,
      cite.CONTENT_URI_PERCENT_ENCODING,
      cite.SCHEMA_OBJECT,
    ],
    expected: valid ? "accepted" : "rejected",
    expectedValues: valid ? { p: { R: "100", G: "200" } } : null,
    rationale:
      "The location uses content to specify its representation. Section 4.12.4 requires URI percent-decoding and describes percent-encoding when a Parameter Object incorporates a media type that has no URI encoding of its own. JSON therefore receives the decoded query string. The valid representation supplies both required string properties; the malformed representation cannot be read as JSON. Both requests use exactly the same document.",
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          content: { "application/json": { schema: REQUIRED_STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    // The query string is the whole of what follows the `?`, so this one is a
    // JSON document written where a query string goes. Percent-encoded because
    // braces and quotes are what a query string carries least well, and the
    // encoding is the canonical one rather than a probe dimension here.
    request: request(
      valid ? "/t?%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D" : "/t?%7Bnot-json",
    ),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: "application/json",
      schema: "object",
      probeAxis: valid ? "canonical" : "foreignWireShape",
    },
    varies: ["whether the decoded query string is well-formed JSON"],
    holdsConstant: [
      "the application/json media type",
      "the schema requires both string properties",
      "URI percent-encoding",
      "exactly one parameter is declared",
    ],
  })),
  {
    id: "querystring-form-urlencoded-object-wrong-type-oas32",
    title: "querystring, x-www-form-urlencoded, object, a property well-formed for another type",
    inShort:
      "The query string parses cleanly, then its R property is blue where the schema says integer. The case that tells a library which validated from one which never looked.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      PARAMETER_LOCATIONS_QUERYSTRING,
      FIXED_FIELDS_FOR_USE_WITH_CONTENT,
      cite.PARAMETER_REQUIRED,
      cite.SCHEMA_OBJECT,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "`R=blue&G=200` is a well-formed form-urlencoded value, so nothing about reading it fails and the whole question is the schema: R is declared integer and blue is not an integer under the ordinary numeric conversions. Acceptance shows that this invalid value passed; a rejection alone does not establish which check refused it.",
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          content: { [FORM_URLENCODED]: { schema: MIXED_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?R=blue&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "wrongTypeValue",
    },
    varies: ["a property spells one type while being well-formed for another"],
    holdsConstant: [
      "the query string is well-formed for the declared media type",
      "exactly one parameter is declared",
      "canonical encoding",
    ],
  },
  {
    id: "querystring-absent-no-question-mark-oas32",
    title: "querystring, optional, request carrying no query string at all",
    inShort:
      "A target with no `?`. Asks whether a querystring parameter is absent or present and empty when there is no query string to read.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      PARAMETER_LOCATIONS_QUERYSTRING,
      FIXED_FIELDS_FOR_USE_WITH_CONTENT,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "required is false and written out, so a request the parameter is not in is valid and a library rejecting it has inverted its required check. That much is settled. What is not is whether the parameter is absent here at all: with no `?` there is no query string to read, and reading the empty string instead deserializes to the empty object, which this schema admits. Both readings accept, so no values are expected and the value channel is where libraries part. The case below sends `/t?` and asks the same question of a query string that is present and empty; one case cannot show that a library collapsed the two.",
    answeredInValues: true,
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: false,
          content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "optionalAbsent",
    },
    varies: ["the request carries no query string"],
    holdsConstant: [
      "the parameter is optional, so the verdict does not turn on the required check",
      "the schema requires no property, so an empty object is admitted",
      "exactly one parameter is declared",
    ],
  },
  {
    id: "querystring-empty-after-question-mark-oas32",
    title: "querystring, optional, request carrying an empty query string",
    inShort:
      "A target ending in `?`. The same question as the case above, asked of a request that does carry a query string, which happens to be empty.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      PARAMETER_LOCATIONS_QUERYSTRING,
      FIXED_FIELDS_FOR_USE_WITH_CONTENT,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "The query string is present and empty, where the case above has none at all. An empty form-urlencoded value is a well-formed representation of the empty object and the schema requires no property, so acceptance is settled here for a second reason as well as the first: the parameter is optional either way. The value is what differs, and what differs between this case and the one above is what shows whether a library kept the distinction the wire carries.",
    answeredInValues: true,
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: false,
          content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "emptyContainer",
    },
    varies: ["the query string is present and empty"],
    holdsConstant: [
      "the parameter is optional, so the verdict does not turn on the required check",
      "the schema requires no property, so an empty object is admitted",
      "exactly one parameter is declared",
    ],
  },
  {
    id: "querystring-declared-with-schema-oas32",
    title: "querystring declared with schema instead of content",
    inShort: "The document breaks the rule that this location must be declared with `content`.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "The document is invalid: the value is the whole query string, so `schema` has nothing to describe the serialization of, and the specification forbids the field here. What a validator does when handed it is not written down. Refusing the document and validating the request as though the parameter were declared some other way are each consistent with what is written.",
    basis: null,
    answeredInValues: true,
    breaksDocumentRule: {
      citation: FIXED_FIELDS_FOR_USE_WITH_SCHEMA,
      detail:
        "`schema` is one of the fields for use with `schema`, and those MUST NOT be used " +
        'with `in: "querystring"`, which MUST be specified using `content`. The dimensions ' +
        "recorded beside this case name a media type the document does not declare: an " +
        "invalid document has no serialization to record, and the coverage coordinates " +
        "have no shape that says so.",
      detectedByMetaSchema: true,
    },
    document: document(
      [{ name: "p", in: "querystring", required: true, schema: STRING_OBJECT }],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    // The coordinates below describe a serialization this document does not
    // have. `Dimensions` offers two shapes, a `schema` parameter carrying a
    // style and an explode, or a `content` parameter carrying a media type, and
    // a document declaring `schema` where `content` is required is neither.
    // Nothing serializes here, so there is no media type to record and no style
    // either, and either shape records something the document never wrote.
    // `content` with the media type the valid cases send is the choice made,
    // and `breaksDocumentRule.detail` says so in the measurement itself, where
    // a reader of `corpus.json` meets the field rather than this comment.
    //
    // Written down rather than designed away. A third shape meaning "no
    // serialization applies" would reach `probedStage`, `canBeAsked`, the
    // surface placement and every branch on `declaration`, to describe a case
    // that fills no coverage cell: `placeContentCases` drops a document-rule
    // case before it reaches the surface.
    //
    // One thing to watch. `canBeAsked` reads `declaration` and so asks for
    // content deserialization ownership here. A library that declares style
    // deserialization, disclaims content deserialization, and accepts 3.2 would
    // be recorded `stageNotOwned` on a document carrying no media type. No
    // measured library does all three today, and whoever meets that empty cell
    // should find this rather than derive it again.
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "documentRule",
    },
    varies: ["the parameter is declared with schema rather than content"],
    holdsConstant: ["the request is the canonical one", "exactly one parameter is declared"],
  },
  {
    id: "querystring-content-with-style-oas32",
    title: "querystring declared with content and style",
    inShort: "The document adds a `style` the location may not carry.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "`style` is among the fields the specification names as not for use with this location, and it says nothing about what a validator does with a document carrying one. The parameter is otherwise the canonical one, so a library refusing this and accepting the canonical case refused the field rather than the location, and one that ignores the field answers the request as though it were not there.",
    basis: null,
    answeredInValues: true,
    breaksDocumentRule: {
      citation: FIXED_FIELDS_FOR_USE_WITH_SCHEMA,
      detail:
        '`style` is one of the fields that MUST NOT be used with `in: "querystring"`, and ' +
        "the parameter carries it alongside the `content` the location requires.",
      detectedByMetaSchema: true,
    },
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          style: "form",
          content: { [FORM_URLENCODED]: { schema: REQUIRED_STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "documentRule",
    },
    varies: ["the parameter carries a style"],
    holdsConstant: ["the request is the canonical one", "exactly one parameter is declared"],
  },
  {
    id: "querystring-declared-twice-oas32",
    title: "two querystring parameters in one operation",
    inShort: "The document declares the location twice, which it may appear at most once.",
    tier: "divergence",
    oasVersion: "3.2",
    basis: null,
    answeredInValues: true,
    question:
      "Both parameters claim the entire query string, and the specification says the location MUST NOT appear more than once without saying what a validator does when handed two. There is no reading under which each gets its own value, so a library that accepts has taken one, taken both, or read neither, and which it did shows in the values.",
    breaksDocumentRule: {
      citation: PARAMETER_LOCATIONS_QUERYSTRING,
      detail: 'Two parameters declare `in: "querystring"` in the same operation.',
      detectedByMetaSchema: true,
    },
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
        },
        {
          name: "q",
          in: "querystring",
          required: true,
          content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "duplicateName",
    },
    varies: ["the location is declared twice"],
    holdsConstant: ["the request is the canonical one", "both declarations are identical"],
  },
  {
    id: "querystring-beside-query-oas32",
    title: "querystring alongside an in: query parameter",
    inShort:
      "One operation declaring both, which the specification forbids. The request carries a query string that answers either reading.",
    tier: "divergence",
    oasVersion: "3.2",
    basis: null,
    answeredInValues: true,
    question:
      "Each location's own bullet forbids the combination, so the document breaks a rule written twice, and neither bullet says what a validator does with a document that breaks it. The two locations divide the same bytes twice, one as pairs and one whole, and the specification forbids the combination rather than saying how to reconcile them. `R=100&G=200` is a legitimate value for each of them read alone, so a library that accepts this document reports values for one, the other, or both, and that is the answer worth having.",
    breaksDocumentRule: {
      // The `query` bullet, which is the same prohibition written from the other
      // side. Either bullet is the rule this document breaks, and this case
      // carries the one the other cases do not, so both statements stay quoted
      // in the corpus rather than one of them being described from memory.
      citation: PARAMETER_LOCATIONS_QUERY,
      detail:
        'The operation declares `in: "querystring"` and `in: "query"` together, which each ' +
        "location's own bullet forbids.",
      detectedByMetaSchema: true,
    },
    document: document(
      [
        {
          name: "p",
          in: "querystring",
          required: true,
          content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
        },
        { name: "R", in: "query", required: true, schema: { type: "string" } },
      ],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "competingParameter",
    },
    varies: ["an in: query parameter is declared beside the querystring one"],
    holdsConstant: [
      "the request is the canonical one for both readings",
      "the querystring declaration is the canonical one",
    ],
  },
];

/**
 * The document a 3.1 mirror of these would carry, and the reason there is no
 * mirror case.
 *
 * `querystring` is a 3.2 location, so a 3.1 document declaring it fails the 3.1
 * meta-schema on the `in` enumeration. A case built on that would measure what a
 * library does with an unrecognised `in` value, which is a question worth asking
 * and is not this one: nothing in it is about the query string, and every
 * location the corpus does not carry would have an equally good claim to the
 * same case. It wants an axis and a name of its own.
 *
 * Kept here as a constructed document rather than as a sentence, so the claim
 * that the older meta-schemas reject it is checked rather than asserted.
 */
export const querystringUnder31 = documentBuilders("3.1.1").document(
  [
    {
      name: "p",
      in: "querystring",
      required: true,
      content: { [FORM_URLENCODED]: { schema: STRING_OBJECT } },
    },
  ],
  "/t",
);
