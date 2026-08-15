import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas30";
import {
  BOOLEAN,
  INTEGER,
  INTEGER_ARRAY,
  INTEGER_OBJECT,
  MIXED_OBJECT,
  NULLABLE_STRING,
  REQUIRED_STRING_OBJECT,
  STRING,
  STRING_ARRAY,
  STRING_OBJECT,
  document,
  request,
} from "./build";

/**
 * Query parameters, under 3.0.4.
 *
 * The largest group in this tranche, mirroring the 3.1 twins: 3.0.4's style
 * table matches 3.1.1's row for row, including the object columns for
 * spaceDelimited and pipeDelimited. The nullable cases spell null admission
 * the 3.0 way, with the `nullable` keyword on a single-string `type`.
 */
export const queryCases30: readonly Case[] = [
  {
    id: "query-content-and-schema-declared-oas30",
    title: "query, both content and schema declared",
    inShort:
      "Declares both content and schema on one parameter, which the specification forbids. " +
      "What a validator does with a document that breaks the rule is not written.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "A parameter MUST include either content or schema and not both, and this one " +
      "includes both. The two prescribe different serializations of the same value, so a " +
      "library that honours either is following one of the two rules the document states. " +
      "The specification constrains the document rather than the validator, and does not " +
      "say which wins.",
    basis: cite.PARAMETER_CONTENT_OR_SCHEMA,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_OBJECT,
          content: { "application/json": { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?p=%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D"),
    dimensions: {
      declaration: "content",
      location: "query",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "competingParameter",
    },
    breaksDocumentRule: {
      citation: cite.PARAMETER_CONTENT_OR_SCHEMA,
      detail: "both content and schema are declared where exactly one is allowed",
      detectedByMetaSchema: true,
    },
    varies: ["both declaration forms are present"],
    holdsConstant: [
      "the identifier is the declared one",
      "the value is a well-formed representation of the content form",
    ],
  },
  {
    id: "query-content-json-object-canonical-oas30",
    title: "query, content application/json, object, canonical",
    inShort:
      "A JSON object percent-encoded into a query value, declared by media type rather than " +
      "by style.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_CONTENT_OR_SCHEMA,
      cite.PARAMETER_CONTENT_COMPLEX_SCENARIOS,
      cite.PARAMETER_CONTENT,
      cite.MEDIA_TYPE_OBJECT,
      cite.URI_PERCENT_DECODING,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The value is a percent-encoded JSON object, which is what a query string can carry " +
      "of the declared representation. Percent-decoding is ordinary URI processing and " +
      "happens before the value is read as its media type, so what reaches the schema is " +
      "the object.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          content: { "application/json": { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?p=%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D"),
    dimensions: {
      declaration: "content",
      location: "query",
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
    id: "query-content-json-object-malformed-oas30",
    title: "query, content application/json, object, value is not JSON",
    inShort:
      "The query value is {not-json where application/json was declared, so nothing parses " +
      "and no schema is ever reached.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_CONTENT_OR_SCHEMA,
      cite.PARAMETER_CONTENT_COMPLEX_SCENARIOS,
      cite.PARAMETER_CONTENT,
      cite.MEDIA_TYPE_OBJECT,
      cite.URI_PERCENT_DECODING,
      cite.SCHEMA_OBJECT,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The declared representation is application/json and the value is not JSON, so there " +
      "is nothing for the schema to be evaluated against. Distinct from a value that parses " +
      "and then fails its schema.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          content: { "application/json": { schema: STRING_OBJECT } },
        },
      ],
      "/t",
    ),
    request: request("/t?p=%7Bnot-json"),
    dimensions: {
      declaration: "content",
      location: "query",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "foreignWireShape",
    },
    varies: ["the value is not a representation of the declared media type"],
    holdsConstant: ["one media type is declared", "the identifier is the declared one"],
  },
  {
    id: "query-content-two-media-types-oas30",
    title: "query, content declaring two media types",
    inShort:
      "Declares two media types where the map must hold one. Refusing the document and " +
      "picking an entry are both defensible.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The map MUST contain one entry and this one contains two, so the document breaks a " +
      "rule addressed to whoever wrote it. The specification does not say what a validator " +
      "does when it is handed one. Refusing the document, choosing an entry, and validating " +
      "against whichever matches are all answers a reader might expect.",
    basis: cite.PARAMETER_CONTENT,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          content: {
            "application/json": { schema: STRING_OBJECT },
            "text/plain": { schema: STRING },
          },
        },
      ],
      "/t",
    ),
    request: request("/t?p=%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D"),
    dimensions: {
      declaration: "content",
      location: "query",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "competingParameter",
    },
    breaksDocumentRule: {
      citation: cite.PARAMETER_CONTENT,
      detail: "the content map holds two entries where the specification allows one",
      detectedByMetaSchema: true,
    },
    varies: ["two media types are declared where one is allowed"],
    holdsConstant: [
      "the identifier is the declared one",
      "the value is a well-formed representation of the first",
    ],
  },
  {
    id: "query-deep-object-canonical-oas30",
    title: "query, deepObject, object, explode true, canonical",
    inShort: "Sends p[R]=100&p[G]=200, the bracketed spelling deepObject uses for an object.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_DEEP_OBJECT],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale: "deepObject with explode true is the one defined deepObject combination.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "deepObject",
          explode: true,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p%5BR%5D=100&p%5BG%5D=200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "deepObject",
      explode: true,
      schema: "object",
      declaredStyle: "deepObject",
      declaredExplode: true,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "canonical encoding of the brackets"],
  },
  {
    id: "query-deep-object-no-explode-oas30",
    title: "query, deepObject, object, explode false",
    inShort:
      "deepObject with explode false, a combination the specification calls undefined, sent " +
      "as the bracketed pairs anyway.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "deepObject with explode false is named by the specification as undefined. What " +
      "does an implementation do with a combination it is told nothing about?",
    basis: cite.PARAMETER_EXPLODE,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "deepObject",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p%5BR%5D=100&p%5BG%5D=200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "deepObject",
      explode: false,
      schema: "object",
      declaredStyle: "deepObject",
      declaredExplode: false,
      probeAxis: "declarationFlag",
    },
    varies: ["explode, into a combination the specification calls undefined"],
    holdsConstant: ["identifier is the declared one", "wire shape as for the defined combination"],
  },
  {
    id: "query-form-array-canonical-explode-oas30",
    title: "query, form, array, explode true, canonical",
    inShort: "The ordinary way to send a list in a query: repeat the name, p=blue&p=black.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.STYLE_EXAMPLE_FORM_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "form with explode true repeats the name once per item, and is the query default.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: true,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue&p=black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      schema: "array",
      declaredStyle: "form",
      declaredExplode: true,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "one parameter declared", "non-empty"],
  },
  {
    id: "query-form-array-canonical-no-explode-oas30",
    title: "query, form, array, explode false, canonical",
    inShort: "A list in one query parameter, comma-joined: p=blue,black",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.STYLE_EXAMPLE_FORM_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "form with explode false is one occurrence of the name carrying CSV.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue,black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "array",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "one occurrence of the name"],
  },
  {
    id: "query-form-array-duplicate-name-oas30",
    title: "query, form, array, explode false, but the name repeats",
    inShort:
      "The name repeats, which is the exploded wire form, while the declaration says " +
      "explode is off. Nothing says which one wins.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The declaration says explode false, and the wire carries the exploded shape. Does " +
      "an implementation follow the declaration, follow the wire, or refuse?",
    basis: null,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue&p=black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "array",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "duplicateName",
    },
    varies: ["the identifier appears more than once"],
    holdsConstant: ["identifier is the declared one", "each value well-formed"],
  },
  {
    id: "query-form-array-empty-value-oas30",
    title: "query, form, array, the name present with an empty value",
    inShort:
      "Sends p= with nothing after it for an array. Empty list, list of one empty string, " +
      "and absent are all readings of p= with nothing after it.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The Style Examples table gives ?name= as the serialization of an undefined value. " +
      "The parameter is required and the name is present. Is a required parameter " +
      "satisfied by the serialization of undefined, an empty array, or neither?",
    basis: cite.STYLE_EXAMPLE_FORM_NO_EXPLODE,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p="),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "array",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "emptyContainer",
    },
    varies: ["the container is empty"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-array-integer-items-oas30",
    title: "query, form, exploded array of integers, canonical wire form",
    inShort:
      "Repeats the name with 1 and 2 for an array of integers, so something has to turn " +
      "text into numbers, and the specification leaves that conversion open.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The wire carries the digits 1 and 2 for an array of integers. Does a decimal " +
      "string satisfy type integer after deserialization? Appendix B leaves the " +
      "conversion between strings and other primitives implementation-defined, so the " +
      "specification declines to settle it.",
    basis: cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: true,
          schema: INTEGER_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=1&p=2"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      schema: "array",
      declaredStyle: "form",
      declaredExplode: true,
      probeAxis: "canonical",
    },
    varies: ["the item type is numeric rather than string"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-array-unset-style-oas30",
    title: "query, array, style and explode both left to the default",
    inShort:
      "Sends p=blue&p=black with nothing declared about its format, so form and explode " +
      "both have to come from the defaults.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.STYLE_EXAMPLE_FORM_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "The declaration writes neither style nor explode, so the library must resolve " +
      "form for a query parameter and then true for explode under form, before it can " +
      "deserialize anything. The wire form is identical to the case that declares both, " +
      "so the pair differs only in whether a default had to be resolved. The defaulted " +
      "form is reported to be much the more common in published documents; that report " +
      "is not this repository's measurement, and is recorded under Figures from " +
      "elsewhere in coverage.md.",
    document: document([{ name: "p", in: "query", required: true, schema: STRING_ARRAY }], "/t"),
    request: request("/t?p=blue&p=black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "array",
      probeAxis: "canonical",
    },
    varies: ["style and explode are left to the default"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the effective style"],
  },
  {
    id: "query-form-boolean-literal-oas30",
    title: "query, form, boolean scalar, the word a boolean is written as",
    inShort:
      "Sends p=true where the schema says boolean. Every value in a query is text, so " +
      "something has to decide whether that word is the boolean it spells.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The wire carries the four letters true for a parameter declared boolean. A boolean " +
      "is one of the JSON Schema data model's primitives and a URL carries no primitives " +
      "at all, so something has to convert, and Appendix B leaves the conversion between " +
      "strings and other primitives implementation-defined. Accepting it as the boolean it " +
      "spells and refusing a string against a boolean are both readings. The neighbouring " +
      "conformance case asks whether a library refuses a word that is no boolean under any " +
      "reading; this asks what it does with the one word that is.",
    basis: cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: BOOLEAN,
        },
      ],
      "/t",
    ),
    request: request("/t?p=true"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: ["the declared type is boolean and the value is well-formed for it"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-boolean-wrong-type-oas30",
    title: "query, form, boolean scalar, a value that is not one",
    inShort:
      "Sends p=blue where the schema says boolean. Nothing turns that word into true or " +
      "false, so a library that treats a present value as truthy accepts what it should not.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.SCHEMA_OBJECT, cite.JSON_SCHEMA_DATA_MODEL],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The JSON Schema data model recognises booleans as one of its four primitive types, " +
      "and the word blue is not one under any reading. A library that converts text to " +
      "primitives has nothing to convert it to; a library that converts nothing is holding " +
      "a string against a boolean. Both reject, so the conversion question Appendix B " +
      "leaves open does not reach this and the verdict is attributable.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: BOOLEAN,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "wrongTypeValue",
    },
    varies: ["the declared type is boolean, which no other case declares"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-object-canonical-explode-oas30",
    title: "query, form, object, explode true",
    inShort:
      "An exploded object sent as its own properties: R=100&G=200. The parameter's own name " +
      "never appears in the request.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.STYLE_EXAMPLE_FORM_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "An exploded form object serializes as its own properties, so the declared " +
      "parameter name appears nowhere in the query string. This is the shape most " +
      "likely to be confused with two unrelated query parameters.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: true,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?R=100&G=200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["wire shape matches the declared style", "values well-formed"],
  },
  {
    id: "query-form-object-canonical-no-explode-oas30",
    title: "query, form, object, explode false",
    inShort: "An object in one query parameter, keys and values alternating: p=R,100,G,200",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.STYLE_EXAMPLE_FORM_NO_EXPLODE],
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
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p=R,100,G,200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-object-integer-properties-oas30",
    title: "query, form, object of integers, canonical wire form",
    inShort:
      "The same question the integer array asks, asked of an object: p=R,100,G,200 where " +
      "both properties are integers, so something has to turn 100 into a number.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The wire carries the digits 100 and 200 for an object whose properties are both " +
      "integers. Does a decimal string satisfy type integer once the object has been " +
      "deserialized? Appendix B leaves the conversion between strings and other " +
      "primitives implementation-defined, and says nothing about whether being inside an " +
      "object changes that, so a library may reasonably convert the properties, leave them " +
      "as the text it split, or reject the request.",
    basis: cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: INTEGER_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p=R,100,G,200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "object",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: ["the property type is numeric rather than string"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-object-missing-name-oas30",
    title: "query, form, object, explode true, entirely absent",
    inShort:
      "No query string at all for a required exploded object, whose absence looks like an " +
      "empty request rather than a missing name.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_EXPLODE, cite.PARAMETER_REQUIRED],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "A required exploded form object serializes as its own properties, so its absence " +
      "looks like an empty query string rather than a missing named parameter. There is " +
      "nothing whose absence a name check could notice, which is the condition under " +
      "which a library is most likely to accept nothing at all. The schema requires both " +
      "properties: without that, the empty object would validate, and RFC 6570 treats a " +
      "zero-member associative array as undefined, making an empty query string a " +
      "legitimate serialization of a schema-valid value and the rejection unsettled.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: true,
          schema: REQUIRED_STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "object",
      probeAxis: "missingName",
    },
    varies: ["the declared parameter is absent entirely"],
    holdsConstant: ["style and explode are stated", "no foreign parameter present"],
  },
  {
    id: "query-form-object-wrong-type-oas30",
    title: "query, form, object, explode true, a property well-formed for a different type",
    inShort:
      "The object arrives fine, then its R property is blue where the schema says integer. " +
      "Watches whether validation reaches inside an object.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.SCHEMA_OBJECT, cite.JSON_SCHEMA_DATA_MODEL],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The object deserializes cleanly and one property then fails its declared type. " +
      "The value is alphabetic against an integer, so no conversion left to " +
      "implementations reaches it. This asks whether schema validation runs through to " +
      "an object's properties, which the accepting object cases cannot ask.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: true,
          schema: MIXED_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?R=blue&G=200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "object",
      probeAxis: "wrongTypeValue",
    },
    varies: ["a property value is well-formed for a different type"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-form-scalar-allow-empty-value-declared-oas30",
    title: "query, form, scalar, allowEmptyValue declared and the value is empty",
    inShort:
      "Sends p= for a required parameter declaring allowEmptyValue, which the specification " +
      "says means unused. Required and unused at the same time.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The parameter is required and declares allowEmptyValue, and the request carries the " +
      "name with a zero-length value. The specification says a server SHOULD read that as " +
      "the parameter being unused, which for a required parameter means absent, and in the " +
      "same paragraph hands the interaction with the schema to implementations. The " +
      "document asks for two things at once and the specification settles neither: is a " +
      "required parameter satisfied by a value declared to mean unused?",
    basis: cite.PARAMETER_ALLOW_EMPTY_VALUE,
    document: document(
      [{ name: "p", in: "query", required: true, allowEmptyValue: true, schema: STRING }],
      "/t",
    ),
    request: request("/t?p="),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "declarationFlag",
    },
    varies: ["allowEmptyValue is declared, which the corpus otherwise leaves unset"],
    holdsConstant: ["the identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "query-form-scalar-allow-reserved-declared-oas30",
    title: "query, form, scalar, allowReserved declared and reserved characters unencoded",
    inShort:
      "The value carries an unencoded slash and colon, and allowReserved says to let " +
      "reserved characters through.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_ALLOW_RESERVED, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: { p: "a/b:c" },
    rationale:
      "allowReserved is declared, so the reserved set passes through unencoded, and the " +
      "request carries exactly that. The slash and the colon are the value rather than " +
      "delimiters, and nothing else in the request is unusual.",
    document: document(
      [{ name: "p", in: "query", required: true, allowReserved: true, schema: STRING }],
      "/t",
    ),
    request: request("/t?p=a/b:c"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "declarationFlag",
    },
    varies: ["allowReserved is declared, which the corpus otherwise leaves unset"],
    holdsConstant: ["the identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "query-form-scalar-allow-reserved-percent-triple-oas30",
    title: "query, form, scalar, allowReserved declared and the value carries a percent triple",
    inShort:
      "With allowReserved on, the value carries an encoded %2F. Whether that stays a triple " +
      "or becomes a slash is the disagreement.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "allowReserved is declared and the value carries %2F. The specification says " +
      "percent-encoded triples pass through unchanged, which describes what a client " +
      "writes rather than what a server reads back. Unchanged from the sender's side is " +
      "the literal three characters; a reader that decodes anyway gets a slash. Both are " +
      "readings of the same sentence and it does not choose between them.",
    basis: cite.PARAMETER_ALLOW_RESERVED,
    answeredInValues: true,
    document: document(
      [{ name: "p", in: "query", required: true, allowReserved: true, schema: STRING }],
      "/t",
    ),
    request: request("/t?p=a%2Fb"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "declarationFlag",
    },
    varies: ["a percent-encoded triple appears where reserved characters may pass unencoded"],
    holdsConstant: ["the identifier is the declared one", "allowReserved is declared"],
  },
  {
    id: "query-form-scalar-allow-reserved-unset-oas30",
    title: "query, form, scalar, reserved characters unencoded with allowReserved left unset",
    inShort:
      "The same unencoded slash and colon with allowReserved left off, a field about how a " +
      "client writes rather than what a server takes.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "allowReserved defaults to false, so a client should have percent-encoded the slash, " +
      "and this request did not. The specification states what serialization the " +
      "declaration prescribes and not what a validator owes a request that ignored it. " +
      "Reading the slash as data and refusing it as a mis-serialized value are both " +
      "consistent with a rule written about the sender.",
    basis: cite.PARAMETER_ALLOW_RESERVED,
    document: document([{ name: "p", in: "query", required: true, schema: STRING }], "/t"),
    request: request("/t?p=a/b:c"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "encodingVariant",
    },
    varies: ["the wire carries reserved characters the declaration did not permit unencoded"],
    holdsConstant: ["the identifier is the declared one", "allowReserved is left unset"],
  },
  {
    id: "query-form-scalar-integer-fractional-oas30",
    title: "query, form, integer scalar, a number with a fraction",
    inShort:
      "Sends p=1.5 where the schema says integer. Whether the implementation-defined " +
      "conversion may truncate before the mathematical integer test is left open.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The wire carries 1.5 for a schema saying integer. A conversion that preserves the " +
      "value yields a number failing the mathematical integer test, and no conversion at " +
      "all holds a string against integer; both of those reject. Appendix B leaves the " +
      "conversion between strings and other primitives implementation-defined and does not " +
      "say it preserves the value, and the truncating conversion several languages ship " +
      "reads 1.5 as 1, which the schema accepts. Nothing rules the truncating reading out, " +
      "so the verdict is open in a way it is not for a value made of letters, which no " +
      "conversion of the representation turns into an integer.",
    basis: cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: INTEGER,
        },
      ],
      "/t",
    ),
    request: request("/t?p=1.5"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "wrongTypeValue",
    },
    varies: ["the value is well-formed for a number and not for the declared integer"],
    holdsConstant: [
      "identifier is the declared one",
      "wire shape matches the declared style",
      "the value is a numeric lexeme",
    ],
  },
  {
    id: "query-form-scalar-integer-oas30",
    title: "query, form, integer scalar, canonical",
    inShort:
      "Sends p=100 where the schema says integer. The plainest form of a question the " +
      "corpus already asks of arrays and objects: is a decimal string a number yet?",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The wire carries the digits 100 for a parameter declared integer. Every value in a " +
      "URL is text, so something has to decide whether that text satisfies type integer, " +
      "and Appendix B leaves the conversion between strings and other primitives " +
      "implementation-defined. The array and object cases ask this of values recovered " +
      "from a container; this asks it where there is no container and no deserialization " +
      "to attribute an answer to.",
    basis: cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "form",
          explode: false,
          schema: INTEGER,
        },
      ],
      "/t",
    ),
    request: request("/t?p=100"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "scalar",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: ["the declared type is numeric rather than string"],
    holdsConstant: [
      "identifier is the declared one",
      "wire shape matches the declared style",
      "the value is well-formed for the declared type",
    ],
  },
  {
    id: "query-form-scalar-missing-name-oas30",
    title: "query, form, scalar, the declared name absent",
    inShort:
      "The query carries x where p was declared, so a parameter is present and it is the " +
      "wrong one.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_NAME, cite.PARAMETER_REQUIRED],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "A required parameter is absent, and a different name is present in its place. " +
      "The presence of some query parameter is not the presence of this one.",
    document: document(
      [{ name: "p", in: "query", required: true, style: "form", explode: false, schema: STRING }],
      "/t",
    ),
    request: request("/t?x=blue"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      schema: "scalar",
      declaredStyle: "form",
      declaredExplode: false,
      probeAxis: "missingName",
    },
    varies: ["the declared identifier is absent"],
    holdsConstant: ["wire shape matches the declared style", "value well-formed"],
  },
  {
    id: "query-form-scalar-nullable-absent-oas30",
    title: "query, form, nullable scalar, required and nothing sent",
    inShort:
      "A required parameter whose type allows null is left out entirely. Absent and null " +
      "look the same on the wire and different to a schema.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "This is null's own serialization. OpenAPI defers to RFC 6570 for which values count " +
      "as undefined, that list includes null, and an undefined variable is ignored by the " +
      "expansion process, so a client sending null sends nothing. The parameter is required " +
      "and admits null, so the wire form that means null is the same wire form that means " +
      "absent, and a library cannot tell the two apart from the request alone. The schema " +
      "admits null through 3.0's nullable keyword; 3.0 has no type arrays.",
    basis: cite.RFC6570_UNDEFINED_INCLUDES_NULL,
    document: document([{ name: "p", in: "query", required: true, schema: NULLABLE_STRING }], "/t"),
    request: request("/t"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "nullableScalar",
      probeAxis: "missingName",
    },
    varies: ["the schema admits null and the wire carries null's own serialization"],
    holdsConstant: ["the style is the defaulted one", "one parameter declared"],
  },
  {
    id: "query-form-scalar-nullable-empty-oas30",
    title: "query, form, nullable scalar, name present with a zero-length value",
    inShort:
      "Sends p= for a nullable parameter, where the empty string is either a value or a way " +
      "of spelling null.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_FORM_EXPLODE,
      cite.EMPTY_STRING_NOT_UNDEFINED,
      cite.RFC6570_UNDEFINED_INCLUDES_NULL,
      cite.NULLABLE,
    ],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "The name is present with a zero-length value, and the schema admits both a string " +
      "and null. Read as the empty string, which the specification says is not undefined, " +
      "it is a value the schema accepts; read as the serialization of an undefined null, " +
      "the Style Examples table's ?color= column, it is the other value the schema " +
      "accepts. Every reading accepts, so the verdict is settled. Which value comes back " +
      "is not, so no values are expected: the readings part only in the value channel. " +
      "The schema admits null through 3.0's nullable keyword; 3.0 has no type arrays.",
    document: document([{ name: "p", in: "query", required: true, schema: NULLABLE_STRING }], "/t"),
    request: request("/t?p="),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "nullableScalar",
      probeAxis: "emptyContainer",
    },
    varies: ["the schema admits null as well as the empty string the wire could carry"],
    holdsConstant: ["identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "query-form-scalar-nullable-literal-oas30",
    title: "query, form, nullable scalar, the value spells the other admitted type",
    inShort:
      "Sends the four letters null for a nullable parameter, which is either that string or " +
      "the null it spells.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_FORM_EXPLODE,
      cite.DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED,
      cite.NULLABLE,
    ],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "The wire carries the four characters n, u, l, l for a schema admitting a string or " +
      "null. Read as a string they are an ordinary value the schema accepts; read through " +
      "the implementation-defined conversion Appendix B allows, they are the null the " +
      "schema also accepts. Every reading accepts, so the verdict is settled. The value " +
      "handed back is where the readings part, and no values are expected because the " +
      "specification does not choose between them. The schema admits null through 3.0's " +
      "nullable keyword; 3.0 has no type arrays.",
    document: document([{ name: "p", in: "query", required: true, schema: NULLABLE_STRING }], "/t"),
    request: request("/t?p=null"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "nullableScalar",
      probeAxis: "wrongTypeValue",
    },
    varies: ["the value spells one admitted type while being well-formed for another"],
    holdsConstant: ["identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "query-form-scalar-optional-absent-oas30",
    title: "query, form, scalar, optional and absent",
    inShort:
      "Declares p as optional and sends nothing at all. Accepting is settled; what the " +
      "values carry for an absent optional parameter is not.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_REQUIRED],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "required defaults to false and this declaration writes it out, so a request " +
      "without the parameter is valid and a library that rejects it has inverted its " +
      "required check. What the caller receives is open: the key absent from the values, " +
      "the key present as null, and the key present with something the library supplied " +
      "are each defensible, so no values are expected and the value channel is where " +
      "libraries part.",
    document: document(
      [{ name: "p", in: "query", required: false, style: "form", explode: false, schema: STRING }],
      "/t",
    ),
    request: request("/t"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "optionalAbsent",
    },
    varies: ["the declared parameter is optional and absent"],
    holdsConstant: ["style and explode are stated", "no foreign parameter present"],
  },
  {
    id: "query-form-scalar-optional-default-absent-oas30",
    title: "query, form, scalar, optional with a schema default, absent",
    inShort:
      "An optional p whose schema carries default blue, and nothing sent. Whether a " +
      "library invents the default is what the values answer.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.PARAMETER_REQUIRED, cite.SCHEMA_DEFAULT],
    expected: "accepted",
    expectedValues: null,
    rationale:
      "The same absent optional parameter, with a default in its schema. Acceptance is " +
      "settled by required being false. The value channel is where this case lives, and " +
      "3.0 gives it its own flavor: the specification says the default is what would be " +
      "assumed by the consumer of the input if none is provided, which reads as an " +
      "invitation a JSON Schema annotation is not. A library injecting blue and a " +
      "library handing back nothing both have textual cover, so no values are expected.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: false,
          style: "form",
          explode: false,
          schema: { type: "string", default: "blue" },
        },
      ],
      "/t",
    ),
    request: request("/t"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "optionalAbsent",
    },
    varies: ["the schema carries a default the specification says a consumer would assume"],
    holdsConstant: ["style and explode are stated", "no foreign parameter present"],
  },
  {
    id: "query-form-scalar-unset-style-oas30",
    title: "query, scalar, style and explode both left to the default",
    inShort:
      "Sends p=blue with nothing declared about its format, so the query default has to be " +
      "resolved before reading it.",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_FORM_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "The most common shape in published documents: a query parameter with a scalar " +
      "schema and no serialization keywords at all. Explode has no effect on a scalar, " +
      "so only the style default is under test here.",
    document: document([{ name: "p", in: "query", required: true, schema: STRING }], "/t"),
    request: request("/t?p=blue"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: ["style and explode are left to the default"],
    holdsConstant: ["identifier is the declared one", "value well-formed"],
  },
  {
    id: "query-pipe-delimited-array-canonical-oas30",
    title: "query, pipeDelimited, array, canonical",
    inShort: "A list joined with encoded pipes: p=blue%7Cblack",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_PIPE_DELIMITED],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "pipeDelimited with explode false separates items with an encoded pipe.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "pipeDelimited",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue%7Cblack"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "pipeDelimited",
      explode: false,
      schema: "array",
      declaredStyle: "pipeDelimited",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "canonical encoding of the delimiter"],
  },
  {
    id: "query-pipe-delimited-object-canonical-oas30",
    title: "query, pipeDelimited, object, canonical",
    inShort:
      "An object joined with encoded pipes, keys and values alternating: " + "p=R%7C100%7CG%7C200",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_PIPE_DELIMITED],
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
          in: "query",
          required: true,
          style: "pipeDelimited",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p=R%7C100%7CG%7C200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "pipeDelimited",
      explode: false,
      declaredStyle: "pipeDelimited",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "query-space-delimited-array-canonical-oas30",
    title: "query, spaceDelimited, array, canonical",
    inShort: "A list joined with encoded spaces: p=blue%20black",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SPACE_DELIMITED],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "spaceDelimited with explode false separates items with an encoded space.",
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "spaceDelimited",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue%20black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "spaceDelimited",
      explode: false,
      schema: "array",
      declaredStyle: "spaceDelimited",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "canonical encoding of the delimiter"],
  },
  {
    id: "query-space-delimited-array-explode-oas30",
    title: "query, spaceDelimited, array, explode true",
    inShort:
      "spaceDelimited with explode true, a combination the table marks undefined, sent as " +
      "repeated names.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "spaceDelimited with explode true is marked n/a in the Style Examples table, and " +
      "the specification states that the behaviour of such combinations is undefined.",
    basis: cite.UNDEFINED_COMBINATIONS,
    document: document(
      [
        {
          name: "p",
          in: "query",
          required: true,
          style: "spaceDelimited",
          explode: true,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t?p=blue&p=black"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "spaceDelimited",
      explode: true,
      schema: "array",
      declaredStyle: "spaceDelimited",
      declaredExplode: true,
      probeAxis: "foreignWireShape",
    },
    varies: ["explode, into a combination the specification calls undefined"],
    holdsConstant: ["identifier is the declared one", "values well-formed"],
  },
  {
    id: "query-space-delimited-object-canonical-oas30",
    title: "query, spaceDelimited, object, canonical",
    inShort: "An object joined with encoded spaces: p=R%20100%20G%20200",
    tier: "conformance",
    oasVersion: "3.0",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SPACE_DELIMITED],
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
          in: "query",
          required: true,
          style: "spaceDelimited",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t?p=R%20100%20G%20200"),
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "spaceDelimited",
      explode: false,
      declaredStyle: "spaceDelimited",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
];
