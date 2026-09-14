import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING, STRING_OBJECT, document, request } from "./build";

/**
 * Query parameters, under 3.2.0.
 *
 * Two pairs, and every one of the four sends a request some 3.1 case also
 * sends. What moved is the tier.
 *
 * The deepObject pair: 3.1 calls deepObject with explode false undefined, so
 * its twin there is divergence and nobody can fail it, and 3.2 says the flag
 * has no effect for this style, so the wire form is the one defined form and
 * the case is attributable. The exploded case is here beside it because a
 * version that says a flag has no effect is a claim about a pair. A library
 * that reads the flag answers the two differently, and one of them alone could
 * not show that.
 *
 * The plus pair: 4.12.4 is new text making WHATWG form-urlencoded decoding a
 * MUST for query strings a `query` parameter produced, which reads an
 * unencoded + as a space. 3.0 and 3.1 name both decoders in Appendix E and
 * choose neither, so the unencoded twin is divergence there and conformance
 * here. The percent-encoded case is its control: a library converting every
 * plus it sees passes the first and fails this one.
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
      "The deepObject row gives one bracketed pair per scalar property, and the request " +
      "carries exactly that with the brackets percent-encoded as the row writes them.",
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
      "The same bracketed pairs with explode false, which this version says has no effect " +
      "for this style. Earlier versions call the pairing undefined.",
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
      "explode has no effect when the style is deepObject, and the table gives one row for " +
      "the style rather than one per explode value. So the declaration describes the same " +
      "serialization as its exploded twin, and the request carries it.",
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
    id: "query-form-scalar-unencoded-plus-oas32",
    title: "query, form, scalar, the value carries an unencoded plus",
    inShort:
      "Sends p=a+b. 3.2 makes WHATWG form-urlencoded decoding a MUST for query strings, " +
      "which reads the plus as a space.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [cite.PARAMETER_STYLE, cite.URL_PERCENT_ENCODING, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: { p: "a b" },
    rationale:
      "A query string produced by an in: query parameter MUST parse and percent-decode " +
      "under WHATWG rules, and the same sentence says those rules treat a " +
      "non-percent-encoded + as an escaped space. So the value reaching the schema is a, " +
      "a space, b. Its 3.0 and 3.1 twins send the same request and are divergence: those " +
      "versions name both decoders in Appendix E and pick neither, and this sentence is " +
      "what 3.2 added.",
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
  {
    id: "query-form-scalar-encoded-plus-oas32",
    title: "query, form, scalar, the value carries a percent-encoded plus",
    inShort:
      "Sends p=a%2Bb, where WHATWG decoding yields a literal plus. The control that keeps " +
      "the unencoded case from passing for the wrong reason.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [cite.PARAMETER_STYLE, cite.URL_PERCENT_ENCODING, cite.SCHEMA_OBJECT],
    expected: "accepted",
    expectedValues: { p: "a+b" },
    rationale:
      "WHATWG form-urlencoded decoding converts an unencoded + to a space and " +
      "percent-decodes %2B to a literal +, so the value reaching the schema is a+b. This " +
      "is the other side of the unencoded twin and the reason both are here: a library " +
      "that turns every plus into a space answers that one correctly and this one wrong, " +
      "and either case alone would not show it. This one asks nothing 3.0 and 3.1 do not " +
      "also settle, which is why they carry a twin of it too.",
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
    varies: ["the wire carries a percent-encoded plus, which no other case sends"],
    holdsConstant: [
      "the identifier is the declared one",
      "the style is the defaulted one",
      "the value is well-formed for the declared type",
    ],
  },
];
