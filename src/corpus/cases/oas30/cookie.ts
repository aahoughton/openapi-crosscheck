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
      "Puts a comma-joined list in one cookie crumb. The style table says that is how it is " +
      "written, and an appendix says form in a cookie is wrong for more than one value.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The form row without explode joins an array with commas under one name, and a cookie " +
      "can carry that pair as its crumb. Appendix D then says form in a cookie is incorrect " +
      "for multiple values whether or not explode produced them, and an array of two is " +
      "multiple values. A library reading the table and a library reading the appendix " +
      "disagree about whether this document describes anything at all.",
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
      "Sends the same cookie name twice, once per item. Nothing says what joins repeated " +
      "crumbs, so a library picks a separator or refuses.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The form row with explode repeats the name once per item, and it writes that in query " +
      "syntax: ?color=blue&color=black. A cookie is not a query string and separates its " +
      "crumbs with semicolons, so the table prescribes the repetition without prescribing " +
      "what joins the repeats here. Ampersand, semicolon, and refusing an exploded array in " +
      "a cookie at all are each consistent with what is written.",
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
      "Packs an object into one cookie crumb as R,100,G,200. The table shows exactly this, " +
      "and an appendix calls form in a cookie wrong for several values.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "The Style Examples table gives this exact serialization for an object under this " +
      "style and explode, and an object of two properties is the multiple values Appendix D " +
      "calls incorrect in a cookie. Accepting the crumb the table describes and refusing a " +
      "combination the specification disowns are both readings of what is written. Object " +
      "schemas are where the styles differ most from one another, so the disagreement is " +
      "widest here.",
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
      "Sends the object's properties as their own cookies, R and G, so nothing in the " +
      "request says they belong to p.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "An exploded form object drops the parameter name and serializes its properties as " +
      "their own pairs, written in the table as ?R=100&G=200. In a cookie those pairs become " +
      "crumbs, and a crumb named R is indistinguishable from any other cookie of that name. " +
      "Whether a library reassembles them into p, and what it joins them with, is not stated.",
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
      "One cookie, one value, nothing unusual. An appendix still calls this ambiguous, " +
      "because one of its two definitions of the format was written for query strings and " +
      "starts with a ? no cookie carries.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "form is the default style for cookie parameters, and a scalar serializes to " +
      "name=value, which is what the cookie carries. Appendix D calls that combination " +
      "ambiguous for a single value and implementation-defined between two readings: form " +
      "expansion, which includes the ? the cookie syntax has no place for, and the style " +
      "example, which does not. A reader expects the single crumb, and neither reading " +
      "uniquely produces it.",
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
      "The same single cookie with explode turned on. Explode has nothing to spread over " +
      "one value, so the flag should change nothing.",
    tier: "divergence",
    oasVersion: "3.0",
    question:
      "Explode has nothing to distribute over a scalar, so the exploded and unexploded form " +
      "rows give the same crumb, and Appendix D's ambiguity for a single value in a cookie " +
      "covers both. The case exists because a library may branch on the flag before noticing " +
      "that there is nothing to distribute, and because the appendix says the ambiguity holds " +
      "whether or not explode is what produced the values.",
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
