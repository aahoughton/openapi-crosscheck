import type { Citation } from "../../types/case";

/**
 * Specification text, quoted verbatim from the OpenAPI 3.0.4 source document.
 *
 * Named constants rather than text repeated per case, so the same paragraph
 * cannot drift between two transcriptions of it. Each case still carries its
 * own citation, and the constant is spread onto the case at construction, so
 * the quoted text is on the loaded object and lands in the stored output
 * without anyone following an import to check it exists.
 *
 * The 3.0.4 patch release carries the same appendices as 3.1.1, including
 * Appendix B (data type conversion) and Appendix D (serializing headers and
 * cookies), under the same anchors. Its Style Examples table matches 3.1.1
 * row for row. Where 3.0.4's wording differs from 3.1.1 (the Schema Object
 * intro), the 3.0.4 text is quoted.
 */

const SPEC = "https://spec.openapis.org/oas/v3.0.4.html";

function cite(anchor: string, quoted: string): Citation {
  return { oasVersion: "3.0", anchor, url: `${SPEC}#${anchor}`, quoted };
}

export const PARAMETER_NAME = cite(
  "parameter-name",
  "REQUIRED. The name of the parameter. Parameter names are case sensitive.",
);

/** The rule that makes the wire form a consequence of the declaration. */
export const PARAMETER_STYLE = cite(
  "parameter-style",
  "Describes how the parameter value will be serialized depending on the type of the " +
    'parameter value. Default values (based on value of in): for "query" - "form"; for ' +
    '"path" - "simple"; for "header" - "simple"; for "cookie" - "form".',
);

/**
 * How a parameter's schema is evaluated, which the style rules do not state.
 *
 * 3.0's Schema Object is an extended subset of an early JSON Schema draft
 * rather than 3.1's superset of Draft 2020-12, which is why `type` takes one
 * string and null arrives through `nullable` instead of `type: "null"`.
 */
export const SCHEMA_OBJECT = cite(
  "schema-object",
  "The Schema Object allows the definition of input and output data types. These types " +
    "can be objects, but also primitives and arrays. This object is an extended subset " +
    "of the JSON Schema Specification Draft Wright-00.",
);

/**
 * 3.0's way of admitting null: a modifier on a single-string `type`, inert
 * without one, and overridable by every other constraint in the schema.
 */
export const NULLABLE = cite(
  "schema-nullable",
  "This keyword only takes effect if type is explicitly defined within the same Schema " +
    "Object. A true value indicates that both null values and values of the type " +
    "specified by type are allowed. Other Schema Object constraints retain their defined " +
    "behavior, and therefore may disallow the use of null as a value. A false value " +
    "leaves the specified or default type unmodified. The default value is false.",
);

export const JSON_SCHEMA_DATA_MODEL = cite(
  "appendix-b-data-type-conversion",
  "Schema Objects validate data based on the JSON Schema data model, which only " +
    "recognizes four primitive data types: strings (which are only broadly interoperable " +
    "as UTF-8), numbers, booleans, and null. " +
    "Notably, integers are not a distinct type from other numbers, with type: " +
    '"integer" being a convenience defined mathematically, rather than based on the ' +
    "presence or absence of a decimal point in any string representation.",
);

export const PARAMETER_REQUIRED = cite(
  "parameter-required",
  "Determines whether this parameter is mandatory. If the parameter location is " +
    '"path", this field is REQUIRED and its value MUST be true. Otherwise, the field ' +
    "MAY be included and its default value is false.",
);

export const PARAMETER_EXPLODE = cite(
  "parameter-explode",
  "When this is true, parameter values of type array or object generate separate " +
    "parameters for each value of the array or key-value pair of the map. For other " +
    'types of parameters this field has no effect. When style is "form", the default ' +
    "value is true. For all other styles, the default value is false. Note that despite " +
    "false being the default for deepObject, the combination of false with deepObject is " +
    "undefined.",
);

export const HEADER_NAMES_CASE_INSENSITIVE = cite(
  "parameter-locations",
  "header - Custom headers that are expected as part of the request. Note that " +
    "[RFC7230] Section 3.2 states header names are case insensitive.",
);

/**
 * The Style Examples table settles the exact wire form for each style, explode
 * and type combination. Rows are quoted as they appear, which is why they carry
 * the table's pipe delimiters: a paraphrase of a table row is not a quotation.
 */
export const STYLE_EXAMPLE_MATRIX_EXPLODE = cite(
  "style-examples",
  "| matrix | true | ;color | ;color=blue | ;color=blue;color=black;color=brown | " +
    ";R=100;G=200;B=150 |",
);

export const STYLE_EXAMPLE_MATRIX_NO_EXPLODE = cite(
  "style-examples",
  "| matrix | false | ;color | ;color=blue | ;color=blue,black,brown | " +
    ";color=R,100,G,200,B,150 |",
);

export const STYLE_EXAMPLE_LABEL_EXPLODE = cite(
  "style-examples",
  "| label | true | . | .blue | .blue.black.brown | .R=100.G=200.B=150 |",
);

export const STYLE_EXAMPLE_SIMPLE_EXPLODE = cite(
  "style-examples",
  "| simple | true | _empty_ | blue | blue,black,brown | R=100,G=200,B=150 |",
);

export const STYLE_EXAMPLE_LABEL_NO_EXPLODE = cite(
  "style-examples",
  "| label | false | . | .blue | .blue,black,brown | .R,100,G,200,B,150 |",
);

export const STYLE_EXAMPLE_SIMPLE_NO_EXPLODE = cite(
  "style-examples",
  "| simple | false | _empty_ | blue | blue,black,brown | R,100,G,200,B,150 |",
);

export const STYLE_EXAMPLE_FORM_EXPLODE = cite(
  "style-examples",
  "| form | true | ?color= | ?color=blue | ?color=blue&color=black&color=brown | " +
    "?R=100&G=200&B=150 |",
);

export const STYLE_EXAMPLE_FORM_NO_EXPLODE = cite(
  "style-examples",
  "| form | false | ?color= | ?color=blue | ?color=blue,black,brown | " +
    "?color=R,100,G,200,B,150 |",
);

export const STYLE_EXAMPLE_SPACE_DELIMITED = cite(
  "style-examples",
  "| spaceDelimited | false | _n/a_ | _n/a_ | ?color=blue%20black%20brown | " +
    "?color=R%20100%20G%20200%20B%20150 |",
);

export const STYLE_EXAMPLE_PIPE_DELIMITED = cite(
  "style-examples",
  "| pipeDelimited | false | _n/a_ | _n/a_ | ?color=blue%7Cblack%7Cbrown | " +
    "?color=R%7C100%7CG%7C200%7CB%7C150 |",
);

export const STYLE_EXAMPLE_DEEP_OBJECT = cite(
  "style-examples",
  "| deepObject | true | _n/a_ | _n/a_ | _n/a_ | ?color%5BR%5D=100&color%5BG%5D=200&" +
    "color%5BB%5D=150 |",
);

/** The reason a combination can be undefined rather than wrong. */
export const EMPTY_STRING_NOT_UNDEFINED = cite(
  "style-examples",
  "The undefined column replaces the empty column in previous versions of this " +
    "specification in order to better align with [RFC6570] Section 2.3 terminology, " +
    'which describes certain values including but not limited to null as "undefined" ' +
    "values with special handling; notably, the empty string is not undefined",
);

export const UNDEFINED_COMBINATIONS = cite(
  "style-examples",
  "The behavior of combinations marked _n/a_ is undefined",
);

/**
 * The specification declining to settle something is itself citable, and it is
 * what separates a divergence case from an unwritten conformance case.
 */
export const DATA_TYPE_CONVERSION_IMPLEMENTATION_DEFINED = cite(
  "appendix-b-data-type-conversion",
  "However, there is no general-purpose specification for converting schema-validated " +
    "non-UTF-8 primitive data types (or entire arrays or objects) to strings. [...] This " +
    "is one reason for the OpenAPI Specification to leave these conversions as " +
    "implementation-defined: It allows using RFC6570 implementations regardless of how " +
    "they choose to perform the conversions.",
);

/**
 * 3.0's own description of `default`, which 3.1 does not restate: there the
 * Schema Object defers to JSON Schema 2020-12, where `default` is an
 * annotation and annotations do not modify the instance.
 */
export const SCHEMA_DEFAULT = cite(
  "json-schema-keywords",
  "default - The default value represents what would be assumed by the consumer of the " +
    "input as the value of the schema if one is not provided. Unlike JSON Schema, the " +
    "value MUST conform to the defined type for the Schema Object defined at the same " +
    "level.",
);

export const PARAMETER_SCHEMA = cite(
  "parameter-schema",
  "The schema defining the type used for the parameter.",
);

/**
 * The rule that makes `content` a second declaration form rather than an extra.
 *
 * Every case in this corpus before it was declared with `schema`, so the whole
 * of the other way was unprobed.
 */
export const PARAMETER_CONTENT_OR_SCHEMA = cite(
  "x4-7-12-2-fixed-fields",
  "The rules for serialization of the parameter are specified in one of two ways. " +
    "Parameter Objects MUST include either a content field or a schema field, but not both.",
);

export const PARAMETER_CONTENT = cite(
  "parameter-content",
  "A map containing the representations for the parameter. The key is the media type " +
    "and the value describes it. The map MUST only contain one entry.",
);

/**
 * What ties the declared media type to the schema that judges the value.
 *
 * `parameter-content` says the map's key is a media type and its value
 * describes it. This is the sentence saying what the description consists of,
 * and it is why a value that is not a representation of the declared media type
 * reaches no schema: the schema belongs to that media type rather than to the
 * bytes.
 */
export const MEDIA_TYPE_OBJECT = cite(
  "media-type-object",
  "Each Media Type Object provides schema and examples for the media type identified by " +
    "its key.",
);

/** The `content` form described as carrying a media type and a schema together. */
export const PARAMETER_CONTENT_COMPLEX_SCENARIOS = cite(
  "fixed-fields-for-use-with-content",
  "For more complex scenarios, the content field can define the media type and schema of " +
    "the parameter, as well as give examples of its use.",
);

/**
 * Percent-decoding as a step over the URI, applied without regard to what the
 * decoded octets turn out to be.
 *
 * A `content` parameter in a query has to be percent-encoded to be a legal URI,
 * so something decodes it before anything reads it as its media type. This is
 * the text placing that step at the URI level, where it is indifferent to the
 * representation underneath.
 */
export const URI_PERCENT_DECODING = cite(
  "decoding-uris-and-form-urlencoded-strings",
  "The percent-decoding algorithm does not care which characters were or were not " +
    "percent-decoded, which means that URIs percent-encoded according to any specification " +
    "will be decoded correctly.",
);

export const RFC6570_UNDEFINED_INCLUDES_NULL = cite(
  "appendix-b-data-type-conversion",
  "[RFC6570] Section 2.3 specifies which values, including but not limited to null, are " +
    "considered undefined and therefore treated specially in the expansion process when " +
    "serializing based on that specification",
);

/**
 * The specification declining to settle `form` in a cookie, in its own words.
 *
 * The style table is written in query syntax, and Appendix D is where the
 * specification says what that means for the one location whose syntax is not a
 * query string. It settles nothing and says so twice: ambiguous for one value,
 * incorrect for several.
 */
export const COOKIE_FORM_AMBIGUOUS = cite(
  "appendix-d-serializing-headers-and-cookies",
  'Using style: "form" with in: "cookie" is ambiguous for a single value, and incorrect ' +
    "for multiple values. This is true whether the multiple values are the result of using " +
    "explode: true or not. ... Because implementations that rely on an RFC6570 " +
    "implementation and those that perform custom serialization based on the style example " +
    "will produce different results, it is implementation-defined as to which of the two " +
    "results is correct.",
);

/** The same appendix on why several values in one cookie has no correct form. */
export const COOKIE_FORM_MULTIPLE_VALUES = cite(
  "appendix-d-serializing-headers-and-cookies",
  'For multiple values, style: "form" is always incorrect as name=value pairs in cookies ' +
    "are delimited by ; (a semicolon followed by a space character) rather than &.",
);

/** Query only, and about how a client serializes rather than how a server reads. */
export const PARAMETER_ALLOW_RESERVED = cite(
  "parameter-allow-reserved",
  "When this is true, parameter values are serialized using reserved expansion, as " +
    "defined by [RFC6570] Section 3.2.3, which allows RFC3986's reserved character set, " +
    "as well as percent-encoded triples, to pass through unchanged, while still " +
    "percent-encoding all other disallowed characters (including % outside of " +
    "percent-encoded triples). ... This field only applies to parameters with an in " +
    "value of query. The default value is false.",
);

/**
 * The specification declining to settle it, in its own words. `SHOULD` rather
 * than `MUST`, and the interaction with the schema handed to implementations.
 */
export const PARAMETER_ALLOW_EMPTY_VALUE = cite(
  "parameter-allow-empty-value",
  "If true, clients MAY pass a zero-length string value in place of parameters that " +
    "would otherwise be omitted entirely, which the server SHOULD interpret as the " +
    "parameter being unused. Default value is false. ... Interactions between this field " +
    "and the parameter's Schema Object are implementation-defined. This field is valid " +
    "only for query parameters. Use of this field is NOT RECOMMENDED, and it is likely " +
    "to be removed in a later revision.",
);

/**
 * The matching rule, and in its second half the specification declining to
 * settle what happens when two templates both match.
 */
export const PATHS_CONCRETE_BEFORE_TEMPLATED = cite(
  "paths-path",
  "When matching URLs, concrete (non-templated) paths would be matched before their " +
    "templated counterparts. Templated paths with the same hierarchy but different " +
    "templated names MUST NOT exist as they are identical. In case of ambiguous matching, " +
    "it's up to the tooling to decide which one to use.",
);

/**
 * What binds a segment of the path to one parameter rather than another.
 *
 * The matching rules say which path is selected. This says that each expression
 * marks its own section of the path, which is what makes the first segment of
 * /t/{p}/{q} belong to `p` and the second to `q`, and it is separate from any
 * rule about how a segment is written.
 */
export const PATH_TEMPLATING = cite(
  "path-templating",
  "Path templating refers to the usage of template expressions, delimited by curly braces " +
    "({}), to mark a section of a URL path as replaceable using path parameters. Each " +
    "template expression in the path MUST correspond to a path parameter that is included " +
    "in the Path Item itself and/or in each of the Path Item's Operations.",
);

/** The worked examples the specification gives for each half of that rule. */
export const PATH_TEMPLATING_MATCHING = cite(
  "path-templating-matching",
  "Assuming the following paths, the concrete definition, /pets/mine, will be matched " +
    "first if used: /pets/{petId} /pets/mine The following paths are considered identical " +
    "and invalid: /pets/{petId} /pets/{name} The following may lead to ambiguous " +
    "resolution: /{entity}/me /books/{id}",
);
