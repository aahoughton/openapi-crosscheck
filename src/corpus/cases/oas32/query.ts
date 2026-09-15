import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING, STRING_OBJECT, document, request } from "./build";

/**
 * Query parameters, under 3.2.0.
 *
 * Two pairs cover rules 3.2 settles: explode has no effect on deepObject, and
 * query parameters require WHATWG form-urlencoded decoding. Each pair varies
 * one detail: the explode flag, or whether a plus sign is percent-encoded.
 */
export const queryCases32: readonly Case[] = [
  {
    id: "query-deep-object-canonical-oas32",
    title: "query, deepObject, object, explode true, canonical",
    inShort: "Sends p[R]=100&p[G]=200, the bracketed spelling deepObject uses for an object.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_VALUES_DEEP_OBJECT,
      cite.STYLE_EXAMPLE_DEEP_OBJECT,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The deepObject row writes bracketed property names, with the brackets percent-encoded. Both values match their string schemas.",
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
      declaredStyle: "deepObject",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "canonical encoding of the brackets"],
  },
  {
    id: "query-deep-object-no-explode-oas32",
    title: "query, deepObject, object, explode false",
    inShort:
      "Sends bracketed property names with deepObject and explode false. OpenAPI 3.2 says explode has no effect for this style.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_DEEP_OBJECT,
      cite.STYLE_EXAMPLE_DEEP_OBJECT,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "OpenAPI 3.2 gives deepObject one format regardless of explode. These bracketed pairs therefore encode the same object as the explode-true companion.",
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
      declaredStyle: "deepObject",
      declaredExplode: false,
      schema: "object",
      probeAxis: "declarationFlag",
    },
    varies: ["explode, into a pairing earlier versions call undefined and this one defines"],
    holdsConstant: ["identifier is the declared one", "wire shape as for the exploded twin"],
  },
  {
    id: "query-form-scalar-encoded-plus-oas32",
    title: "query, form, scalar, the value carries a percent-encoded plus",
    inShort: "Sends p=a%2Bb. WHATWG form-urlencoded decoding reads %2B as a literal plus.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [cite.PARAMETER_STYLE, cite.URL_PERCENT_ENCODING, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: { p: "a+b" },
    rationale:
      "WHATWG form-urlencoded decoding reads %2B as +, yielding a+b. Paired with the unencoded-plus case, this checks whether encoded and unencoded plus signs are distinguished.",
    document: document([{ name: "p", in: "query", required: true, schema: STRING }], "/t"),
    request: request("/t?p=a%2Bb"),
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
    varies: ["the value contains a percent-encoded plus"],
    holdsConstant: [
      "the identifier is the declared one",
      "the style is the defaulted one",
      "the value is well-formed for the declared type",
    ],
  },
  {
    id: "query-form-scalar-unencoded-plus-oas32",
    title: "query, form, scalar, the value carries an unencoded plus",
    inShort:
      "Sends p=a+b. OpenAPI 3.2 requires WHATWG form-urlencoded decoding, which reads + as a space.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [cite.PARAMETER_STYLE, cite.URL_PERCENT_ENCODING, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: { p: "a b" },
    rationale:
      "OpenAPI 3.2 requires query parameters to use WHATWG form-urlencoded decoding. An unencoded + becomes a space, so the expected value is a b.",
    document: document([{ name: "p", in: "query", required: true, schema: STRING }], "/t"),
    request: request("/t?p=a+b"),
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
    varies: ["the wire spells a space with a plus rather than a percent-encoded triple"],
    holdsConstant: [
      "the identifier is the declared one",
      "the style is the defaulted one",
      "the value is well-formed for the declared type",
    ],
  },
];
