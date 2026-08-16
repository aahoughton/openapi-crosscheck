import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING_OBJECT, document, request } from "./build";

/**
 * Query parameters, under 3.2.0.
 *
 * Two cases, and they are the same document and the same request as two cases
 * in the 3.1 tranche. What moved is the tier: 3.1 calls deepObject with explode
 * false undefined, so its twin is divergence and nobody can fail it, and 3.2
 * says the flag has no effect for this style, so the wire form is the one
 * defined form and the case is attributable.
 *
 * The exploded case is here beside it because a version that says a flag has no
 * effect is a claim about a pair. A library that reads the flag answers the two
 * differently, and one of them alone could not show that.
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
];
