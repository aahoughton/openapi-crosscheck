import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas30";
import { STRING, STRING_ARRAY, STRING_OBJECT, document, request } from "./build";

/**
 * Cookie parameters, under 3.0.4.
 *
 * The 3.0.4 patch release carries the same Appendix D as 3.1.1, so these cases
 * diverge for the same reasons their 3.1 twins do.
 */
export const cookieCases30: readonly Case[] = [
  {
    id: "cookie-form-array-canonical-no-explode-oas30",
    title: "cookie, form, array, explode false, canonical",
    inShort:
      "Sends one cookie as p=blue,black. The style table shows this format; Appendix D calls form incorrect for multiple cookie values.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The form table joins array items with commas under one name. Appendix D calls form in cookies incorrect for multiple values, including arrays without explode. These descriptions leave acceptance unsettled.",
    basis: cite.COOKIE_FORM_MULTIPLE_VALUES,
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "form",
          explode: false,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue,black"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "cookie-form-array-explode-oas30",
    title: "cookie, form, array, explode true, repeated name",
    inShort:
      "Repeats the cookie name once per item. The form table uses query separators; cookies use semicolons.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "Exploded form arrays repeat the name using & in the style table. Cookie pairs use a semicolon and space. Appendix D calls this combination incorrect, leaving its handling unspecified.",
    basis: cite.STYLE_EXAMPLE_FORM_EXPLODE,
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "form",
          explode: true,
          schema: STRING_ARRAY,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue; p=black"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "array",
      probeAxis: "foreignWireShape",
    },
    varies: ["the location separates repeats differently from the location the table shows"],
    holdsConstant: ["identifier is the declared one", "the style and explode are declared"],
  },
  {
    id: "cookie-form-object-canonical-oas30",
    title: "cookie, form, object, canonical",
    inShort:
      "Sends one cookie as p=R,100,G,200. The style table shows this format; Appendix D calls form incorrect for multiple cookie values.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The form table alternates property names and values under one name. Appendix D calls form in cookies incorrect for multiple values, including objects without explode. These descriptions leave acceptance unsettled.",
    basis: cite.COOKIE_FORM_MULTIPLE_VALUES,
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "form",
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
      style: "form",
      explode: false,
      declaredStyle: "form",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "style is stated rather than defaulted"],
  },
  {
    id: "cookie-form-object-explode-oas30",
    title: "cookie, form, object, explode true",
    inShort:
      "Sends the object's properties as cookies named R and G. The parameter name p is absent.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The exploded form table writes an object's properties as query pairs, ?R=100&G=200. Appendix D calls this style incorrect for multiple cookie values. How to group the cookies into p is unspecified.",
    basis: cite.STYLE_EXAMPLE_FORM_EXPLODE,
    document: document(
      [
        {
          name: "p",
          in: "cookie",
          required: true,
          style: "form",
          explode: true,
          schema: STRING_OBJECT,
        },
      ],
      "/t",
    ),
    request: request("/t", [["Cookie", "R=100; G=200"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "object",
      probeAxis: "competingParameter",
    },
    varies: ["the exploded properties compete with the cookie namespace"],
    holdsConstant: ["the style and explode are declared", "values well-formed"],
  },
  {
    id: "cookie-form-scalar-canonical-oas30",
    title: "cookie, form, scalar, canonical",
    inShort:
      "Sends p=blue using the default cookie style, form. Appendix D calls even a single value ambiguous.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The style example gives name=value. RFC 6570 form expansion adds a leading ?, which cookie syntax does not use. Appendix D leaves the choice between these definitions implementation-defined.",
    basis: cite.COOKIE_FORM_AMBIGUOUS,
    document: document([{ name: "p", in: "cookie", required: true, schema: STRING }], "/t"),
    request: request("/t", [["Cookie", "p=blue"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: false,
      schema: "scalar",
      declaredStyle: "unset",
      declaredExplode: "unset",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "value well-formed", "canonical encoding"],
  },
  {
    id: "cookie-form-scalar-explode-oas30",
    title: "cookie, form, scalar, explode true",
    inShort:
      "Sends p=blue with explode on. The scalar format is unchanged, including form's ambiguity in cookies.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "Both form rows give the same scalar format. Appendix D's ambiguity for a single cookie value applies with either value of explode.",
    basis: cite.COOKIE_FORM_AMBIGUOUS,
    document: document(
      [{ name: "p", in: "cookie", required: true, explode: true, schema: STRING }],
      "/t",
    ),
    request: request("/t", [["Cookie", "p=blue"]]),
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: true,
      declaredStyle: "unset",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: ["explode is written out"],
    holdsConstant: ["identifier is the declared one", "value well-formed", "canonical encoding"],
  },
];
