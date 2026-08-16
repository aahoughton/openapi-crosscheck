import type { Case, Citation } from "../../../types/case";
import { MIXED_OBJECT, REQUIRED_STRING_OBJECT, STRING_OBJECT, document, request } from "./build";
// The 3.1 builder, for the one document here that is deliberately not a 3.2
// document: the check that the older meta-schemas refuse this location.
import { documentBuilders } from "../../build";
import * as cite from "../../citations/oas32";

/**
 * The `in: "querystring"` cases, which OpenAPI 3.2 adds a fifth parameter
 * location for.
 *
 * The location is content-only: its value is the entire query string, so no
 * style applies to it and the specification says the fields for use with
 * `schema` MUST NOT be used with it. That is why these are the only cases in
 * the corpus with no style dimension to vary.
 *
 * Four of them declare a document the specification calls invalid, and each is
 * divergence rather than conformance: a validator handed such a document has to
 * do something and nothing says what, so the case records what each library did
 * and attributes the difference to nobody.
 *
 * The case that matters most is the wrong-typed one. A library that accepts the
 * document and never looks at the parameter accepts every well-formed request
 * here and is indistinguishable from one that validated correctly, so the
 * corpus needs a request only a library that read the parameter can refuse.
 * One library in the roster answers it accepted, which is that failure, and the
 * measurement rather than this comment is where to read who.
 */

const SPEC = "https://spec.openapis.org/oas/v3.2.0.html";

function cite32(anchor: string, quoted: string): Citation {
  return { oasVersion: "3.2", anchor, url: `${SPEC}#${anchor}`, quoted };
}

/**
 * The whole of what 4.12.1 says about the location, quoted as the one sentence
 * it is.
 *
 * Four rules in a single bullet: the value is the entire query string, it MUST
 * be specified using `content`, it MUST NOT appear more than once, and it MUST
 * NOT appear beside an `in: "query"` parameter. Quoting the sentence whole
 * rather than clause by clause, because it is one sentence and a citation that
 * starts after a semicolon reads as a rule of its own.
 *
 * It also names the media type, which is the specification's own pairing rather
 * than an inference from 4.12.2.3.
 *
 * Transcribed from the published 3.2.0 document as rendered, which is the
 * convention every other citation in this repository follows: no markup, string
 * literals keeping the quotes they are written with, and the typographic
 * apostrophe the document uses in "operation" plus s, left as it was found. The
 * ASCII rule covers text this repository writes, and specification text passes
 * through unchanged.
 *
 * This is the first quote in the corpus to test that last part, and the answer
 * is recorded as open rather than settled. The `quoted` field on `Citation`
 * carries the tension and what changing it would take.
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
 * The same exclusion, stated again on the `query` bullet.
 *
 * A second statement rather than the same one: 4.12.1 writes the rule into both
 * locations, so a document declaring both breaks a rule addressed to each of
 * them. The case that declares both cites both.
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
      "The whole query string read as one form-urlencoded value. The positive control, " +
      "and the media type the specification pairs with this location.",
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
      "The parameter's value is the entire query string, and `R=100&G=200` is that string " +
      "read as the media type it declares. Both properties are present and both are " +
      "strings, which is what the schema asks for.",
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
  {
    id: "querystring-json-object-canonical-oas32",
    title: "querystring, application/json, object, percent-encoded",
    inShort:
      "The same location declared with a media type the specification does not pair with " +
      "it, asking whether the query string is decoded before it is parsed.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "Is the query string percent-decoded before it is read as the parameter's declared " +
      "media type? The value of a querystring parameter is the query string as it arrived, " +
      "and a JSON object cannot be written in one without percent-encoding its braces and " +
      "quotes. A library that decodes first reads a JSON object and accepts; one that hands " +
      "the raw string to a JSON parser reads `%7B%22R%22` and rejects. Both are defensible " +
      "readings of a location whose value is defined as the whole query string, and the " +
      "specification pairs this location with `application/x-www-form-urlencoded` rather " +
      "than settling what any other media type does here.",
    basis: null,
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
    request: request("/t?%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "canonical",
    },
    varies: ["media type, which is the only dimension moved from the positive control"],
    holdsConstant: [
      "the target carries a percent-encoded JSON object, which is the only way to write " +
        "one in a query string",
      "the schema and the value it would deserialize to, once decoded",
      "exactly one parameter is declared",
    ],
  },
  {
    id: "querystring-form-urlencoded-object-wrong-type-oas32",
    title: "querystring, x-www-form-urlencoded, object, a property well-formed for another type",
    inShort:
      "The query string parses cleanly, then its R property is blue where the schema says " +
      "integer. The case that tells a library which validated from one which never looked.",
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
      "`R=blue&G=200` is a well-formed form-urlencoded value, so nothing about reading it " +
      "fails and the whole question is the schema: R is declared integer and blue is not " +
      "an integer under any coercion policy. This is the one querystring case whose " +
      "expected verdict is reachable only by reading the parameter. Every other one here " +
      "expects acceptance, and acceptance is what a library that validated correctly and " +
      "a library that never looked both produce.",
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
      "A target with no `?`. Asks whether a querystring parameter is absent or present " +
      "and empty when there is no query string to read.",
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
      "required is false and written out, so a request the parameter is not in is valid " +
      "and a library rejecting it has inverted its required check. That much is settled. " +
      "What is not is whether the parameter is absent here at all: with no `?` there is no " +
      "query string to read, and reading the empty string instead deserializes to the " +
      "empty object, which this schema admits. Both readings accept, so no values are " +
      "expected and the value channel is where libraries part. The case below sends `/t?` " +
      "and asks the same question of a query string that is present and empty; one case " +
      "cannot show that a library collapsed the two.",
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
      "A target ending in `?`. The same question as the case above, asked of a request " +
      "that does carry a query string, which happens to be empty.",
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
      "The query string is present and empty, where the case above has none at all. An " +
      "empty form-urlencoded value is a well-formed representation of the empty object and " +
      "the schema requires no property, so acceptance is settled here for a second reason " +
      "as well as the first: the parameter is optional either way. The value is what " +
      "differs, and what differs between this case and the one above is what shows whether " +
      "a library kept the distinction the wire carries.",
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
      "The document is invalid: the value is the whole query string, so `schema` has " +
      "nothing to describe the serialization of, and the specification forbids the field " +
      "here. What a validator does when handed it is not written down. Refusing the " +
      "document and validating the request as though the parameter were declared some " +
      "other way are each consistent with what is written.",
    basis: null,
    answeredInValues: true,
    breaksDocumentRule: {
      citation: FIXED_FIELDS_FOR_USE_WITH_SCHEMA,
      detail:
        "`schema` is one of the fields for use with `schema`, and those MUST NOT be used " +
        'with `in: "querystring"`, which MUST be specified using `content`.',
      detectedByMetaSchema: true,
    },
    document: document(
      [{ name: "p", in: "querystring", required: true, schema: STRING_OBJECT }],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "content",
      location: "querystring",
      mediaType: FORM_URLENCODED,
      schema: "object",
      probeAxis: "declarationFlag",
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
      "`style` is among the fields the specification names as not for use with this " +
      "location, and it says nothing about what a validator does with a document carrying " +
      "one. The parameter is otherwise the canonical one, so a library refusing this and " +
      "accepting the canonical case refused the field rather than the location, and one " +
      "that ignores the field answers the request as though it were not there.",
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
      probeAxis: "declarationFlag",
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
      "Both parameters claim the entire query string, and the specification says the " +
      "location MUST NOT appear more than once without saying what a validator does when " +
      "handed two. There is no reading under which each gets its own value, so a library " +
      "that accepts has taken one, taken both, or read neither, and which it did shows in " +
      "the values.",
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
      "One operation declaring both, which the specification forbids. The request carries " +
      "a query string that answers either reading.",
    tier: "divergence",
    oasVersion: "3.2",
    basis: null,
    answeredInValues: true,
    question:
      "Each location's own bullet forbids the combination, so the document breaks a rule " +
      "written twice, and neither bullet says what a validator does with a document that " +
      "breaks it. The two locations divide the same bytes twice, one as pairs and one " +
      "whole, and the specification forbids the combination rather than saying how to " +
      "reconcile them. `R=100&G=200` is a legitimate value for each of them read alone, " +
      "so a library that accepts this document reports values for one, the other, or " +
      "both, and that is the answer worth having.",
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
