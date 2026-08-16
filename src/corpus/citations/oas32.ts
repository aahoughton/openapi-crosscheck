import type { Citation } from "../../types/case";

/**
 * Specification text, quoted verbatim from the OpenAPI 3.2.0 source document.
 *
 * Named constants rather than text repeated per case, so the same paragraph
 * cannot drift between two transcriptions of it. Each case still carries its
 * own citation, and the constant is spread onto the case at construction, so
 * the quoted text is on the loaded object and lands in the stored output
 * without anyone following an import to check it exists.
 *
 * Fewer constants than 3.0 or 3.1 carry, because the 3.2 tranche asks what 3.2
 * changed rather than the whole surface again. Everything quoted here is text
 * 3.2.0 states differently from 3.1.1, or text a case about such a change rests
 * on. The shared surface is unasked under 3.2 and shows as empty cells in
 * `coverage.oas32.md`.
 */

const SPEC = "https://spec.openapis.org/oas/v3.2.0.html";

/**
 * Transcribe as the document sets it, punctuation included. Whether that is
 * right is open, and the `quoted` field on `Citation` carries the tension and
 * what changing the answer would take.
 */
function cite(anchor: string, quoted: string): Citation {
  return { oasVersion: "3.2", anchor, url: `${SPEC}#${anchor}`, quoted };
}

/**
 * The default table, which now names two styles for cookies and says which of
 * them the version prefers.
 *
 * The default itself did not move: `form` is still what an undeclared cookie
 * parameter resolves to. What moved is that there is now something else to
 * resolve to, and the parenthesis says the default is kept for compatibility.
 */
export const PARAMETER_STYLE = cite(
  "parameter-style",
  "Describes how the parameter value will be serialized depending on the type of the " +
    'parameter value. Default values (based on value of in): for "query" - "form"; for ' +
    '"path" - "simple"; for "header" - "simple"; for "cookie" - "form" (for compatibility ' +
    'reasons; note that style: "cookie" SHOULD be used with in: "cookie"; see Appendix D ' +
    "for details).",
);

/**
 * Two sentences 3.1.1 wrote differently.
 *
 * 3.1.1 called the combination of explode false with deepObject undefined.
 * 3.2.0 says explode has no effect there at all, which settles a case the
 * earlier versions leave open, and it adds `cookie` to the styles whose default
 * is true.
 */
export const PARAMETER_EXPLODE = cite(
  "parameter-explode",
  "When this is true, parameter values of type array or object generate separate " +
    "parameters for each value of the array or key-value pair of the map. For other types " +
    'of parameters, or when style is "deepObject", this field has no effect. When style is ' +
    '"form" or "cookie", the default value is true. For all other styles, the default ' +
    "value is false.",
);

export const PARAMETER_REQUIRED = cite(
  "parameter-required",
  "Determines whether this parameter is mandatory. If the parameter location is " +
    '"path", this field is REQUIRED and its value MUST be true. Otherwise, the field ' +
    "MAY be included and its default value is false.",
);

/**
 * The field's scope, widened.
 *
 * 3.1.1 ended this paragraph with "This field only applies to parameters with
 * an in value of query", which put it out of reach of every other location.
 * 3.2.0 scopes it by behaviour instead: wherever the serialization
 * percent-encodes, which includes a path parameter under `simple`.
 */
export const PARAMETER_ALLOW_RESERVED = cite(
  "parameter-allow-reserved",
  "When this is true, parameter values are serialized using reserved expansion, as " +
    "defined by [RFC6570] Section 3.2.3, which allows RFC3986's reserved character set, " +
    "as well as percent-encoded triples, to pass through unchanged, while still " +
    "percent-encoding all other disallowed characters (including % outside of " +
    "percent-encoded triples). Applications are still responsible for percent-encoding " +
    "reserved characters that are not allowed by the rules of the in destination or media " +
    "type, or are not allowed in the path by this specification; see URL Percent-Encoding " +
    "for details. The default value is false. This field only applies to in and style " +
    "values that automatically percent-encode.",
);

export const SCHEMA_OBJECT = cite(
  "schema-object",
  "The Schema Object allows the definition of input and output data types. These types " +
    "can be objects, but also primitives and arrays. This object is a superset of the " +
    "JSON Schema Specification Draft 2020-12.",
);

/** The new row of the Style Values table, and the whole of what it defines. */
export const STYLE_VALUES_COOKIE = cite(
  "style-values",
  "| cookie | primitive, array, object | cookie | Analogous to form, but following " +
    "[RFC6265] Cookie syntax rules, meaning that name-value pairs are separated by a " +
    "semicolon followed by a single space (e.g. n1=v1; n2=v2), and no percent-encoding " +
    "or other escaping is applied; data values that require any sort of escaping MUST be " +
    "provided in escaped form. |",
);

export const STYLE_VALUES_DEEP_OBJECT = cite(
  "style-values",
  "| deepObject | object | query | Allows objects with scalar properties to be " +
    "represented using form parameters. The representation of array or object properties " +
    "is not defined (but see Extending Support for Querystring Formats for alternatives). |",
);

export const STYLE_EXAMPLE_COOKIE_EXPLODE = cite(
  "style-examples",
  "| cookie | true | color= | color=blue | color=blue; color=black; color=brown | " +
    "R=100; G=200; B=150 |",
);

export const STYLE_EXAMPLE_COOKIE_NO_EXPLODE = cite(
  "style-examples",
  "| cookie | false | color= | color=blue | color=blue,black,brown | " +
    "color=R,100,G,200,B,150 |",
);

/**
 * The deepObject row, whose explode column is now `n/a` rather than `true`.
 *
 * Read with the explode field's own text, the pair says the same thing twice:
 * the flag does not select a row here, because there is one row.
 */
export const STYLE_EXAMPLE_DEEP_OBJECT = cite(
  "style-examples",
  "| deepObject | _n/a_ | _n/a_ | _n/a_ | _n/a_ | color%5BR%5D=100&color%5BG%5D=200&" +
    "color%5BB%5D=150 |",
);

export const STYLE_EXAMPLE_SIMPLE_NO_EXPLODE = cite(
  "style-examples",
  "| simple | false | _empty_ | blue | blue,black,brown | R,100,G,200,B,150 |",
);

/**
 * The rule that makes a cookie's percent-encoding data rather than encoding.
 *
 * Addressed to both sides, which is what makes it citable for a request: a
 * value that looks percent-encoded is not decoded on the way in, so the three
 * characters `%20` are three characters of the value.
 */
export const COOKIE_PERCENT_ENCODING_NOT_DECODED = cite(
  "fixed-fields-for-use-with-schema",
  'Care is needed for parameters with schema that have in: "header" or in: "cookie", ' +
    'style: "cookie": When serializing these values, URI percent-encoding MUST NOT be ' +
    "applied. When parsing these parameters, any apparent percent-encoding MUST NOT be " +
    "decoded. If using an RFC6570 implementation that automatically performs encoding or " +
    "decoding steps, the steps MUST be undone before use.",
);

/**
 * What the appendix now says about the combination it used to call ambiguous.
 *
 * 3.1.1's Appendix D said form in a cookie is ambiguous for a single value and
 * incorrect for several, and named the disagreement implementation-defined.
 * 3.2.0 replaces that with a sentence about the delimiter and a recommendation
 * to use the new style, and says nothing about what a reader of the wrong
 * delimiter should do.
 */
export const COOKIE_FORM_WRONG_DELIMITER = cite(
  "percent-encoding-and-cookies",
  'If automatic percent-encoding is desired, style: "form" with a primitive value or with ' +
    "the non-default explode value of false provides this behavior. However, note that the " +
    'default value of explode: true for style: "form" with non-primitive values uses the ' +
    "wrong delimiter for cookies (& instead of ; followed by a single space) to set " +
    "multiple cookie values.",
);
