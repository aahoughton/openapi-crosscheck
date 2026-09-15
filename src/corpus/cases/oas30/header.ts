import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas30";
import { rfcCitations } from "../../citations/rfc";
import { INTEGER, STRING, STRING_ARRAY, STRING_OBJECT, document, request } from "./build";

const rfc = rfcCitations("3.0");

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
    inShort: "Sends a JSON object directly in a header, using content: application/json.",
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
      "The content declaration selects application/json. The header contains valid JSON with both properties matching the string schemas.",
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
    id: "header-reserved-name-accept-present-wrong-type-oas30",
    title: "header, a parameter named Accept, present and violating its schema",
    inShort:
      "Declares Accept as an integer and sends Accept: text/html. OpenAPI requires ignoring this parameter declaration.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_NAME_RESERVED_HEADERS, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "A header parameter named Accept SHALL be ignored, so its integer schema cannot invalidate this request. The absent-header companion checks required; this case checks the declared type.",
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
  {
    id: "header-reserved-name-accept-required-absent-oas30",
    title: "header, a parameter named Accept, required and absent",
    inShort:
      "Declares Accept as required and sends no Accept header. OpenAPI requires ignoring this parameter declaration.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_NAME_RESERVED_HEADERS, cite.PARAMETER_REQUIRED],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "A header parameter named Accept SHALL be ignored. Its required flag therefore cannot invalidate a request with no Accept header.",
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
    id: "header-simple-array-canonical-oas30",
    title: "header, simple, array, canonical",
    inShort:
      "Sends p: blue,black with style omitted. The header default, simple, separates array items with commas.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "The default header style is simple, which separates array items with commas.",
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
    rationale: "Header names are case insensitive, so P matches the declared parameter p.",
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
      "Sends p: blue followed by p: black. HTTP combines these list-valued fields in " +
      "order, yielding the same array as p: blue,black.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_STYLE,
      cite.HEADER_NAMES_CASE_INSENSITIVE,
      cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE,
      rfc.HEADER_FIELD_ORDER,
    ],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Simple style defines this header as a comma-separated array. RFC 7230 " +
      "Section 3.2.2 allows repeated list-valued fields to be combined in received " +
      "order without changing the message semantics. The two field lines therefore " +
      "carry the same array as the canonical single-line header.",
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
      "Sends p: blue,black with simple explicitly declared. The companion case uses the same header with style omitted.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Simple style separates array items with commas. This request also appears in the default-style case, allowing the two declarations to be compared.",
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
      "Sends p: blue,black with explode on. Simple arrays use commas with either value of explode.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Both simple array rows separate items with commas, so explode leaves the expected array unchanged.",
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
      "The simple object row with explode false alternates property names and values, separated by commas. R and G both have string values matching their schemas.",
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
      "Sends an object as p: R=100,G=200. Explode joins each property name to its value with =.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The exploded simple object row uses name=value pairs separated by commas. R and G both have string values matching their schemas.",
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
    inShort: "Sends p: blue with simple explicitly declared.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale: "A simple scalar is the header value itself, which satisfies the string schema.",
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
    inShort: "Sends p: blue with explode on. Explode has no effect on a scalar.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Both simple scalar rows give the bare value, so explode leaves the expected string unchanged.",
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
];
