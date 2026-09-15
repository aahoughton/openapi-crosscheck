import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING, document, request } from "./build";

/**
 * Path parameters, under 3.2.0.
 *
 * OpenAPI 3.2 applies `allowReserved` to styles that use percent-encoding,
 * including simple path parameters. These cases send the same segment with
 * the field enabled and omitted. Acceptance is settled for the enabled case;
 * handling of the mismatched serialization in the omitted case is unspecified.
 */
export const pathCases32: readonly Case[] = [
  {
    id: "path-simple-scalar-allow-reserved-declared-oas32",
    title: "path, simple, scalar, allowReserved declared and reserved characters unencoded",
    inShort:
      "Sends a:b@c in the path with allowReserved true. OpenAPI 3.2 permits this field for path parameters.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_ALLOW_RESERVED,
      cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: "a:b@c" },
    rationale:
      "OpenAPI 3.2 applies allowReserved to styles that use percent-encoding, including simple. With it enabled, the colon and at-sign may appear unencoded as part of the string value.",
    document: document([
      { name: "p", in: "path", required: true, allowReserved: true, schema: STRING },
    ]),
    request: request("/t/a:b@c"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "declarationFlag",
    },
    varies: ["allowReserved is declared on a path parameter"],
    holdsConstant: ["the identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "path-simple-scalar-allow-reserved-unset-oas32",
    title: "path, simple, scalar, reserved characters unencoded with allowReserved left unset",
    inShort:
      "Sends a:b@c in the path with allowReserved omitted. The serialization rule calls for percent-encoding.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "allowReserved defaults to false, so the declared serialization percent-encodes the colon and at-sign. The cited rule does not prescribe whether a validator accepts or rejects their unencoded forms.",
    basis: cite.PARAMETER_ALLOW_RESERVED,
    document: document([{ name: "p", in: "path", required: true, schema: STRING }]),
    request: request("/t/a:b@c"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "encodingVariant",
    },
    varies: ["the wire carries reserved characters the declaration did not permit unencoded"],
    holdsConstant: ["the identifier is the declared one", "allowReserved is left unset"],
  },
];
