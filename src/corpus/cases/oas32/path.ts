import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING, document, request } from "./build";

/**
 * Path parameters, under 3.2.0.
 *
 * One field reaches this location for the first time in this version.
 * Through 3.1 `allowReserved` ends with "This field only applies to parameters
 * with an in value of query", so a path parameter declaring it declares
 * something the specification says is not about it. 3.2 scopes the field by
 * behaviour instead, to whichever `in` and `style` values percent-encode, and
 * a path parameter under `simple` is one of those.
 *
 * Two cases, differing in one field of the declaration and nothing on the wire.
 * The pair is the point: the same segment is what the declaration asked for in
 * one and a mis-serialized value in the other, so a library that ignores the
 * field answers them identically and a library that reads it does not.
 */
export const pathCases32: readonly Case[] = [
  {
    id: "path-simple-scalar-allow-reserved-declared-oas32",
    title: "path, simple, scalar, allowReserved declared and reserved characters unencoded",
    inShort:
      "The segment carries an unencoded colon and at-sign, and allowReserved says to let " +
      "reserved characters through. This version is the first where the field reaches a path.",
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
      "simple is the default style for a path parameter and it percent-encodes, which is " +
      "the scope this version gives allowReserved. With the field declared, the reserved " +
      "set passes through unencoded, and the segment carries exactly that. The colon and " +
      "the at-sign are the value rather than delimiters of anything.",
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
    varies: ["allowReserved is declared, in a location no earlier version applies it to"],
    holdsConstant: ["the identifier is the declared one", "the style is the defaulted one"],
  },
  {
    id: "path-simple-scalar-allow-reserved-unset-oas32",
    title: "path, simple, scalar, reserved characters unencoded with allowReserved left unset",
    inShort:
      "The same segment with the field left off, so a client should have encoded the colon. " +
      "The rule is written about the sender and says nothing about the reader.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "allowReserved defaults to false, so the reserved characters should have arrived " +
      "percent-encoded, and they did not. The specification states what serialization the " +
      "declaration prescribes and not what a validator owes a request that ignored it. " +
      "Reading the colon and the at-sign as data and refusing the segment as mis-serialized " +
      "are both consistent with a rule addressed to whoever built the URL.",
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
