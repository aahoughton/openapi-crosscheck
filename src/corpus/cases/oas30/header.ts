import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas30";
import { INTEGER, STRING, STRING_ARRAY, STRING_OBJECT, document, request } from "./build";

/**
 * Header parameters, under 3.0.4.
 *
 * These cases mirror their 3.1 twins byte for byte on the wire: 3.0.4's style
 * table matches 3.1.1's row for row here.
 */
export const headerCases30: readonly Case[] = [
  {
    id: "header-content-json-object-canonical-oas30",
    title: "header, content application/json, object, canonical",
    inShort:
      "Sends a JSON object in a header, declared by media type instead of by style. The " +
      "header carries the JSON as written.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_CONTENT_OR_SCHEMA,
      cite.PARAMETER_CONTENT_COMPLEX_SCENARIOS,
      cite.PARAMETER_CONTENT,
      cite.MEDIA_TYPE_OBJECT,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The parameter declares one representation, application/json, and the header carries " +
      "a well-formed JSON object matching the schema. No style applies, because the " +
      "parameter declares content rather than schema, and the specification gives those as " +
      "the two ways serialization is specified.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          content: { "application/json": { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", '{"R":"100","G":"200"}']]),
    dimensions: {
      declaration: "content",
      location: "header",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "canonical",
    },
    varies: ["the parameter is declared with content rather than schema"],
    holdsConstant: [
      "one media type is declared",
      "the value is a well-formed representation of it",
    ],
  },
  {
    id: "header-simple-array-canonical-oas30",
    title: "header, simple, array, canonical",
    inShort:
      "Sends p: blue,black with nothing declared about its format, so the header default " +
      "(one comma-separated value) has to be applied.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "simple is the default style for header parameters; an array is comma separated.",
    document: document([{ name: "p", in: "header", required: true, schema: STRING_ARRAY }], "/t"),
    request: request("/t", [["p", "blue,black"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "unset",
      declaredExplode: "unset",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier casing is the declared one", "one header of that name"],
  },
  {
    id: "header-simple-array-case-variant-oas30",
    title: "header, simple, array, header name uppercased",
    inShort:
      "Sends the header name as P where the document declares p. Header names are case " +
      "insensitive, so it still matches.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_STYLE,
      cite.HEADER_NAMES_CASE_INSENSITIVE,
      cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE,
    ],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Header names are case insensitive, so a header sent as P satisfies a parameter " +
      "declared as p. This is the one location where a casing variant must not change " +
      "the verdict.",
    document: document([{ name: "p", in: "header", required: true, schema: STRING_ARRAY }], "/t"),
    request: request("/t", [["P", "blue,black"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "unset",
      declaredExplode: "unset",
      probeAxis: "caseVariant",
    },
    varies: ["casing of the identifier"],
    holdsConstant: ["value well-formed", "one header of that name"],
  },
  {
    id: "header-simple-array-duplicate-name-oas30",
    title: "header, simple, array, the name sent twice",
    inShort:
      "Sends the header twice, once per item, instead of one comma-joined header. Whether " +
      "those fold into one array is not written down.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "Two headers of the declared name arrive. Is that the array, a repeated scalar, " +
      "or an error? The Style Examples table gives one comma-separated header for an " +
      "array and says nothing about repetition.",
    basis: null,
    document: document([{ name: "p", in: "header", required: true, schema: STRING_ARRAY }], "/t"),
    request: request("/t", [
      ["p", "blue"],
      ["p", "black"],
    ]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "unset",
      declaredExplode: "unset",
      probeAxis: "duplicateName",
    },
    varies: ["the identifier appears more than once"],
    holdsConstant: ["identifier is the declared one", "each value well-formed"],
  },
  {
    id: "header-simple-array-explicit-style-oas30",
    title: "header, simple, array, style written out rather than defaulted",
    inShort:
      "The same p: blue,black header, with the serialization spelled out in the document " +
      "instead of left to the default. Separates applying the default from supporting the " +
      "format.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "The same request as the canonical header case, with style written out instead of " +
      "left to the default. The two cases differ only in whether the declaration relies " +
      "on the default, so when a library handles one and not the other, default " +
      "resolution is the difference; the style itself is supported.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          style: "simple",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", "blue,black"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "simple",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: ["style is stated rather than defaulted"],
    holdsConstant: ["identifier is the declared one", "value well-formed", "one header"],
  },
  {
    id: "header-simple-array-explode-oas30",
    title: "header, simple, array, explode true",
    inShort:
      "Sends p: blue,black with explode turned on, which for a header the spec spells " +
      "identically to explode off. The flag should change nothing.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "The simple rows agree on arrays: exploded or not, the items are comma joined. A library " +
      "that treats explode as meaning repeated headers here is reading a rule the table does " +
      "not give.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          style: "simple",
          explode: true,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", "blue,black"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "header-simple-object-canonical-oas30",
    title: "header, simple, object, canonical",
    inShort: "An object flattened into a header as R,100,G,200, keys and values alternating.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The Style Examples table gives this exact serialization for an object under " +
      "this style and explode, so both the verdict and the deserialized value are " +
      "settled. Object schemas are where the styles differ most from one another.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          style: "simple",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", "R,100,G,200"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "style is stated rather than defaulted"],
  },
  {
    id: "header-simple-object-explode-oas30",
    title: "header, simple, object, explode true",
    inShort:
      "The exploded spelling of an object in a header, R=100,G=200, where explode puts an " +
      "equals sign between key and value.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "This is the one place explode changes a simple serialization: the properties are joined " +
      "to their values with equals rather than laid out as a flat comma list.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          style: "simple",
          explode: true,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", "R=100,G=200"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "header-simple-scalar-canonical-oas30",
    title: "header, simple, scalar, canonical",
    inShort: "The plainest header case: one name, one value, the declared style written out.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "The declared style is simple, which is also the header default, and a simple scalar " +
      "is the bare value. The canonical case for the location, against which the header " +
      "variants are read.",
    document: document(
      [
        {
          name: "p",
          in: "header",
          required: true,
          style: "simple",
          explode: false,
          schema: STRING,
        },
      ],
      "/t",
    ),
    request: request("/t", [["p", "blue"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "header-simple-scalar-explode-oas30",
    title: "header, simple, scalar, explode true",
    inShort: "One header value with explode on, which has nothing to spread over.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Both simple rows give the bare value for a scalar, so explode changes nothing that can " +
      "be observed on the wire. What it can change is whether a library takes a different " +
      "path to the same answer.",
    document: document(
      [{ name: "p", in: "header", required: true, style: "simple", explode: true, schema: STRING }],
      "/t",
    ),
    request: request("/t", [["p", "blue"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "header-reserved-name-accept-required-absent-oas30",
    title: "header, a parameter named Accept, required and absent",
    inShort:
      "Declares Accept as a required header parameter and sends no Accept header. The " +
      "declaration is one the specification says to ignore, so the missing value is not " +
      "missing.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_NAME_RESERVED_HEADERS, cite.PARAMETER_REQUIRED],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "A header parameter named Accept SHALL be ignored, and a declaration that is ignored " +
      "cannot require anything. So the absent header is not an absent required parameter " +
      "and the request stands. A library honouring the declaration rejects, which is the " +
      "only other answer available and is attributable.",
    document: document(
      [{ name: "Accept", in: "header", required: true, style: "simple", schema: STRING }],
      "/t",
    ),
    request: request("/t"),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "reservedName",
    },
    varies: ["the declared identifier is one the specification reserves"],
    holdsConstant: ["the style is declared", "one parameter declared"],
  },
  {
    id: "header-reserved-name-accept-present-wrong-type-oas30",
    title: "header, a parameter named Accept, present and violating its schema",
    inShort:
      "Declares Accept with an integer schema and sends a real Accept header. Ignoring the " +
      "declaration means never holding the header against it.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_NAME_RESERVED_HEADERS, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "The request carries the Accept header a client would send, and the declaration says " +
      "that header is an integer. Ignoring the declaration means the schema never applies " +
      "and the request stands. This is the twin of the required-and-absent case and each " +
      "covers the other's blind spot: a library that never checks required would accept " +
      "that one without ignoring anything, and a library that never validates header " +
      "schemas would accept this one the same way. Answering both correctly while " +
      "rejecting neither is what ignoring the declaration looks like.",
    document: document(
      [{ name: "Accept", in: "header", required: true, style: "simple", schema: INTEGER }],
      "/t",
    ),
    request: request("/t", [["Accept", "text/html"]]),
    dimensions: {
      declaration: "schema",
      location: "header",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "reservedName",
    },
    varies: ["the declared identifier is one the specification reserves"],
    holdsConstant: ["the style is declared", "one parameter declared"],
  },
];
