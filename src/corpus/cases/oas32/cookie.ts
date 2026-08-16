import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas32";
import { STRING, STRING_ARRAY, STRING_OBJECT, document, request } from "./build";

/**
 * Cookie parameters, under 3.2.0.
 *
 * The location 3.2 changed most. Through 3.1 every cookie case here is
 * divergence: `form` is the only style a cookie parameter can carry, and an
 * appendix calls that combination ambiguous for one value and incorrect for
 * several, so there is nothing to conform to. 3.2 adds `style: "cookie"`, whose
 * row gives the exact crumbs for each type and explode, and the same wire forms
 * become settled.
 *
 * So these are the same questions the 3.1 cookie cases ask, asked of a document
 * that can now express the answer. What a library does with them is a different
 * measurement from what it does with the 3.1 twins, and the two sit side by
 * side under one library's name.
 *
 * The last case holds the contrast: `form` is still the default style for a
 * cookie parameter, kept for compatibility, and 3.2 says no more about reading
 * one than 3.1 did.
 */
export const cookieCases32: readonly Case[] = [
  {
    id: "cookie-cookie-array-canonical-explode-oas32",
    title: "cookie, cookie style, array, explode defaulted true, canonical",
    inShort:
      "Repeats the cookie name once per item, separated by the semicolon and space cookies " +
      "use. The style table gives exactly these crumbs.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: ["blue", "black", "brown"] },
    rationale:
      "explode is left out and defaults to true for the cookie style, so the exploded row " +
      "applies, and it writes an array as the name repeated with a semicolon and a space " +
      "between the pairs. The request carries that, character for character.",
    document: document(
      [{ name: "p", in: "cookie", required: true, style: "cookie", schema: STRING_ARRAY }],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue; p=black; p=brown"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: true,
      declaredStyle: "cookie",
      declaredExplode: "unset",
      schema: "array",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [
      "identifier is the declared one",
      "wire shape matches the declared style",
      "explode is left to the version's default",
    ],
  },
  {
    id: "cookie-cookie-array-no-explode-oas32",
    title: "cookie, cookie style, array, explode false",
    inShort: "Joins the array with commas inside one crumb, which is the unexploded row.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_NO_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: ["blue", "black", "brown"] },
    rationale:
      "The unexploded cookie row joins an array with commas under one name, which is one " +
      "crumb, and the request carries that crumb.",
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "cookie",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue,black,brown"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: false,
      declaredStyle: "cookie",
      declaredExplode: false,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "cookie-cookie-object-canonical-explode-oas32",
    title: "cookie, cookie style, object, explode defaulted true, canonical",
    inShort:
      "Sends the object's properties as their own crumbs, R and G, which is what the " +
      "exploded row writes and what a browser would send.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "An exploded cookie object drops the parameter name and writes one crumb per " +
      "property, delimited by a semicolon and a space. Recovering p from those crumbs is " +
      "what the row describes, so the object is the value under the declared name.",
    document: document(
      [{ name: "p", in: "cookie", required: true, style: "cookie", schema: STRING_OBJECT }],
      "/t",
    ),
    request: request("/t", [["Cookie", "R=100; G=200"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: true,
      declaredStyle: "cookie",
      declaredExplode: "unset",
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [
      "identifier is the declared one",
      "wire shape matches the declared style",
      "explode is left to the version's default",
    ],
  },
  {
    id: "cookie-cookie-object-no-explode-oas32",
    title: "cookie, cookie style, object, explode false",
    inShort: "Packs the object into one crumb as R,100,G,200, which is the unexploded row.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_NO_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The unexploded cookie row writes an object as its property names and values joined " +
      "by commas under the parameter's own name, which is the crumb the request carries.",
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "cookie",
          explode: false,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=R,100,G,200"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: false,
      declaredStyle: "cookie",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "cookie-cookie-scalar-canonical-oas32",
    title: "cookie, cookie style, scalar, canonical",
    inShort:
      "One cookie, one value, under the style written for cookies. The ambiguity earlier " +
      "versions leave over this crumb is what the style removes.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Both cookie rows give name=value for a string, so the defaulted explode selects " +
      "between two rows that agree, and the crumb the request carries is that pair.",
    document: document(
      [{ name: "p", in: "cookie", required: true, style: "cookie", schema: STRING }],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: true,
      declaredStyle: "cookie",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "value well-formed", "canonical encoding"],
  },
  {
    id: "cookie-cookie-scalar-no-explode-oas32",
    title: "cookie, cookie style, scalar, explode false",
    inShort:
      "The same single crumb with explode written out as false. There is nothing to " +
      "distribute over one value, so the flag should change nothing.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.PARAMETER_EXPLODE,
      cite.STYLE_VALUES_COOKIE,
      cite.STYLE_EXAMPLE_COOKIE_NO_EXPLODE,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "The unexploded cookie row gives name=value for a string, the same crumb the " +
      "exploded row gives. The case exists because a library can branch on the flag before " +
      "noticing that a scalar has nothing to distribute.",
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "cookie",
          explode: false,
          schema: STRING,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: false,
      declaredStyle: "cookie",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: ["explode is written out"],
    holdsConstant: ["identifier is the declared one", "value well-formed", "canonical encoding"],
  },
  {
    id: "cookie-cookie-scalar-percent-triple-oas32",
    title: "cookie, cookie style, scalar, a value carrying a percent triple",
    inShort:
      "The crumb reads blue%20black. Under this style a percent triple is three characters " +
      "of data, and decoding it would hand the caller a value nobody sent.",
    tier: "conformance",
    oasVersion: "3.2",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_VALUES_COOKIE,
      cite.COOKIE_PERCENT_ENCODING_NOT_DECODED,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: "blue%20black" },
    answeredInValues: true,
    rationale:
      "The style applies no percent-encoding and the parsing rule says apparent " +
      "percent-encoding MUST NOT be decoded, so the value is the twelve characters sent. " +
      "The schema admits any string, so the verdict is the same either way and the value " +
      "is where the answer is.",
    document: document(
      [{ name: "p", in: "cookie", required: true, style: "cookie", schema: STRING }],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue%20black"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: true,
      declaredStyle: "cookie",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "encodingVariant",
    },
    varies: ["the value carries characters that look like an encoding of something else"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "cookie-form-array-explode-oas32",
    title: "cookie, form defaulted, array, explode defaulted true",
    inShort:
      "The same repeated crumbs with the style left to its default, which is still form. " +
      "An appendix says form uses the wrong delimiter here and stops there.",
    tier: "divergence",
    oasVersion: "3.2",
    question:
      "A cookie parameter that declares no style still resolves to form, kept for " +
      "compatibility, and the appendix says the exploded form default uses the wrong " +
      "delimiter for cookies: an ampersand where a cookie writes a semicolon and a space. " +
      "The request carries the cookie delimiter. Whether a library reads the crumbs the " +
      "location actually uses, or refuses a serialization the specification calls wrong " +
      "now that a style exists which means it, is not settled.",
    basis: cite.COOKIE_FORM_WRONG_DELIMITER,
    document: document([{ name: "p", in: "cookie", required: true, schema: STRING_ARRAY }], "/t"),
    request: request("/t", [["Cookie", "p=blue; p=black"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "array",
      probeAxis: "foreignWireShape",
    },
    varies: ["the location separates repeats differently from the location the table shows"],
    holdsConstant: [
      "identifier is the declared one",
      "the style is the defaulted one",
      "the wire is the same as the cookie-style twin",
    ],
  },
];
