import type { Case } from "../../../types/case";
import * as cite from "../../citations/oas31";
import {
  INTEGER,
  STRING,
  STRING_ARRAY,
  STRING_OBJECT,
  document,
  documentWithPaths,
  request,
} from "./build";

/**
 * Path parameters, and the routing cases.
 *
 * Three styles apply here and each writes the name into the segment itself,
 * which is why a foreign or missing name in a path is a question about
 * serialization rather than about splitting. The routing cases live here too:
 * they vary which operation a request matches, which is a question about the
 * path before it is a question about any parameter.
 */
export const pathCases: readonly Case[] = [
  {
    id: "path-content-json-object-canonical-oas31",
    title: "path, content application/json, object, canonical",
    inShort:
      "Puts percent-encoded JSON in a path segment, declared by media type: the path twin " +
      "of the query content case.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PARAMETER_CONTENT_OR_SCHEMA,
      cite.PARAMETER_CONTENT_COMPLEX_SCENARIOS,
      cite.PARAMETER_CONTENT,
      cite.MEDIA_TYPE_OBJECT,
      cite.URI_PERCENT_DECODING,
      cite.SCHEMA_OBJECT,
    ],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The value is a percent-encoded JSON object, which is what a path segment can carry " +
      "of the declared representation. Percent-decoding is ordinary URI processing and " +
      "applies to a path segment as to any other component, so what reaches the schema is " +
      "the object. The query twin scores the same way on the same citations; nothing the " +
      "specification says about templating or content distinguishes the locations here, " +
      "and the segment matches the template as one segment either way.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        content: { "application/json": { schema: STRING_OBJECT } },
      },
    ]),
    request: request("/t/%7B%22R%22%3A%22100%22%2C%22G%22%3A%22200%22%7D"),
    dimensions: {
      declaration: "content",
      location: "path",
      mediaType: "application/json",
      schema: "object",
      probeAxis: "canonical",
    },
    varies: ["the location is one where templating also applies"],
    holdsConstant: [
      "one media type is declared",
      "the value is a well-formed representation of it",
    ],
  },
  {
    id: "path-label-array-canonical-oas31",
    title: "path, label, array, canonical",
    inShort: "A label-style array in the path, dot-prefixed and comma-joined: .blue,black",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "label with explode false serializes an array as a dot followed by CSV.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "label",
        explode: false,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/.blue,black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: false,
      schema: "array",
      declaredStyle: "label",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["wire shape matches the declared style", "value well-formed"],
  },
  {
    id: "path-label-array-explode-oas31",
    title: "path, label, array, explode true",
    inShort: "An exploded label array, where each item gets its own dot: .blue.black",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Exploding a label array separates items with dots rather than commas, so the " +
      "wire form differs from the unexploded case on the same values. The pair " +
      "isolates whether a library reads explode at all for this style.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "label",
        explode: true,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/.blue.black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: true,
      declaredStyle: "label",
      declaredExplode: true,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: ["explode"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-label-array-foreign-shape-oas31",
    title: "path, label, array, the wire shape of a different style",
    inShort:
      "Sends blue,black where a label parameter needs a leading dot, so the segment is not " +
      "written in the declared style at all.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_NO_EXPLODE, cite.PARAMETER_REQUIRED],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "Every label serialization begins with a dot. A value with no dot is the simple " +
      "style's shape, and is not a label expansion of anything.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "label",
        explode: false,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/blue,black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: false,
      schema: "array",
      declaredStyle: "label",
      declaredExplode: false,
      probeAxis: "foreignWireShape",
    },
    varies: ["the wire shape belongs to another style"],
    holdsConstant: ["identifier is the declared one", "value well-formed for the type"],
  },
  {
    id: "path-label-object-canonical-oas31",
    title: "path, label, object, canonical",
    inShort: "A label object as .R,100,G,200, keys and values alternating after the dot.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The Style Examples table gives this exact serialization for an object under " +
      "this style and explode, so both the verdict and the deserialized value are " +
      "settled. Object schemas are where the styles differ most from one another.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "label",
        explode: false,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/.R,100,G,200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: false,
      declaredStyle: "label",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-label-object-explode-oas31",
    title: "path, label, object, explode true",
    inShort: "An exploded label object, .R=100.G=200, where every property gets its own dot.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "An exploded label object pairs each property to its value with equals and separates the " +
      "pairs with the dot that also opens the segment, so the first dot and the separating " +
      "dots are the same character doing two jobs.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "label",
        explode: true,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/.R=100.G=200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: true,
      declaredStyle: "label",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-label-scalar-canonical-oas31",
    title: "path, label, scalar, canonical",
    inShort: "One label-style value in the path: .blue",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "A label scalar is a dot followed by the value. The leading dot is part of the " +
      "serialization rather than part of the value, which is the whole of what this case asks.",
    document: document([
      { name: "p", in: "path", required: true, style: "label", explode: false, schema: STRING },
    ]),
    request: request("/t/.blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: false,
      declaredStyle: "label",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-label-scalar-explode-oas31",
    title: "path, label, scalar, explode true",
    inShort: "Sends .blue with explode on, which the spec spells the same as explode off.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_LABEL_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Both label rows give a dot and the value for a scalar, so explode is unobservable here " +
      "and the leading dot is still not part of the value.",
    document: document([
      { name: "p", in: "path", required: true, style: "label", explode: true, schema: STRING },
    ]),
    request: request("/t/.blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "label",
      explode: true,
      declaredStyle: "label",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-matrix-array-canonical-oas31",
    title: "path, matrix, array, explode true, canonical",
    inShort: "A matrix array repeating the name once per item: ;p=blue;p=black",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "The textbook RFC6570 expansion of an exploded matrix array: the name repeats once " +
      "per item. This is the case every other matrix probe varies away from.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: true,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/;p=blue;p=black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: true,
      schema: "array",
      declaredStyle: "matrix",
      declaredExplode: true,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [
      "identifier is the declared one",
      "wire shape matches the declared style",
      "value well-formed",
      "one parameter declared",
    ],
  },
  {
    id: "path-matrix-array-empty-after-parse-oas31",
    title: "path, matrix, array, matrix syntax naming only foreign parameters",
    inShort:
      "The segment is matrix syntax carrying q and r, so reading it correctly yields " +
      "nothing for p. Different from a segment that will not parse at all.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_MATRIX_EXPLODE,
      cite.PARAMETER_NAME,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The segment is well-formed matrix syntax, and every name in it is a name other " +
      "than the declared one. Parameter names are case sensitive and identify the " +
      "parameter, so no value of p is present, and p is required. Distinct from a " +
      "segment that never parsed as matrix at all.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: true,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/;q=blue;r=black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: true,
      schema: "array",
      declaredStyle: "matrix",
      declaredExplode: true,
      probeAxis: "emptyAfterParse",
    },
    varies: ["the identifier is a foreign one"],
    holdsConstant: ["wire shape matches the declared style", "values well-formed"],
  },
  {
    id: "path-matrix-array-foreign-shape-oas31",
    title: "path, matrix, array, no matrix syntax at all",
    inShort:
      "Sends a bare blue where a matrix parameter needs ;p=, so the segment is not matrix " +
      "syntax and no value for p can be read out of it.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_EXPLODE, cite.PARAMETER_REQUIRED],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The segment carries no matrix syntax, so it is not an expansion of p, and p is " +
      "required. Distinct from a segment that parsed as matrix and yielded nothing: this " +
      "one never parsed.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: true,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: true,
      schema: "array",
      declaredStyle: "matrix",
      declaredExplode: true,
      probeAxis: "foreignWireShape",
    },
    varies: ["the wire shape belongs to another style"],
    holdsConstant: ["value well-formed for the item type", "one parameter declared"],
  },
  {
    id: "path-matrix-array-no-explode-oas31",
    title: "path, matrix, array, explode false",
    inShort: "A matrix array under one name, comma-joined: ;p=blue,black",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Without explode a matrix array names the parameter once and comma joins the items, " +
      "rather than repeating the name as the exploded row does.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: false,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/;p=blue,black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      declaredStyle: "matrix",
      declaredExplode: false,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-matrix-competing-parameters-oas31",
    title: "path, matrix, two declared parameters with their segments swapped",
    inShort:
      "Two path segments, each carrying the other's name: ;q=blue then ;p=black. Both names " +
      "are present, and each is in the wrong place.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE,
      cite.PATH_TEMPLATING,
      cite.PARAMETER_NAME,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "Two parameters are declared, and each segment carries the other's name. Both names " +
      "appear in the request, so a check that merely looks for a name somewhere is " +
      "satisfied, while neither parameter has a value in its own position.",
    document: document(
      [
        { name: "p", in: "path", required: true, style: "matrix", explode: false, schema: STRING },
        { name: "q", in: "path", required: true, style: "matrix", explode: false, schema: STRING },
      ],
      "/t/{p}/{q}",
    ),
    request: request("/t/;q=blue/;p=black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      schema: "scalar",
      declaredStyle: "matrix",
      declaredExplode: false,
      probeAxis: "competingParameter",
    },
    varies: ["two parameters declared, each segment naming the other"],
    holdsConstant: ["wire shape matches the declared style", "values well-formed"],
  },
  {
    id: "path-matrix-object-canonical-oas31",
    title: "path, matrix, object, canonical",
    inShort: "A matrix object under one name, keys and values alternating: ;p=R,100,G,200",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The Style Examples table gives this exact serialization for an object under " +
      "this style and explode, so both the verdict and the deserialized value are " +
      "settled. Object schemas are where the styles differ most from one another.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: false,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/;p=R,100,G,200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      declaredStyle: "matrix",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-matrix-object-explode-oas31",
    title: "path, matrix, object, explode true",
    inShort:
      "An exploded matrix object, where each property becomes its own matrix pair: " +
      ";R=100;G=200",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "An exploded matrix object drops the parameter name entirely and names the " +
      "object properties instead, so nothing on the wire carries the declared " +
      "identifier. A library keying off the parameter name has nothing to find.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "matrix",
        explode: true,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/;R=100;G=200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: true,
      declaredStyle: "matrix",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: ["explode"],
    holdsConstant: ["wire shape matches the declared style", "values well-formed"],
  },
  {
    id: "path-matrix-scalar-canonical-oas31",
    title: "path, matrix, scalar, canonical",
    inShort: "One matrix parameter in the path: ;p=blue",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale: "A matrix scalar serializes as ;name=value.",
    document: document([
      { name: "p", in: "path", required: true, style: "matrix", explode: false, schema: STRING },
    ]),
    request: request("/t/;p=blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      schema: "scalar",
      declaredStyle: "matrix",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-matrix-scalar-explode-oas31",
    title: "path, matrix, scalar, explode true",
    inShort: "Sends ;p=blue with explode on, spelled the same as without it.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_MATRIX_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Both matrix rows give the same segment for a scalar, so explode is unobservable, and " +
      "the name inside the segment is still the declared one.",
    document: document([
      { name: "p", in: "path", required: true, style: "matrix", explode: true, schema: STRING },
    ]),
    request: request("/t/;p=blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: true,
      declaredStyle: "matrix",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-matrix-scalar-foreign-name-oas31",
    title: "path, matrix, scalar, a foreign parameter name",
    inShort:
      "The segment is matrix syntax carrying q where p was declared. Something is there, " +
      "and it is not the parameter.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE,
      cite.PARAMETER_NAME,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The segment names q. The declared parameter is p and it is required. No " +
      "serialization of p produces ;q=blue, so p has no value here.",
    document: document([
      { name: "p", in: "path", required: true, style: "matrix", explode: false, schema: STRING },
    ]),
    request: request("/t/;q=blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      schema: "scalar",
      declaredStyle: "matrix",
      declaredExplode: false,
      probeAxis: "foreignName",
    },
    varies: ["the identifier is a foreign one"],
    holdsConstant: ["wire shape matches the declared style", "value well-formed", "one parameter"],
  },
  {
    id: "path-routing-ambiguous-templates-oas31",
    title: "path, two templates that both match the request",
    inShort:
      "Two templates both match /t/me, and the specification says out loud that which one " +
      "wins is up to the tooling.",
    tier: "divergence",
    oasVersion: "3.1",
    question:
      "The request matches both declared templates, and the specification says in so many " +
      "words that it is up to the tooling to decide which one to use. It even gives this " +
      "shape as its own example of ambiguous resolution. Which parameter comes back names " +
      "which path was chosen, so the value channel reports the choice that the verdict " +
      "cannot.",
    basis: cite.PATHS_CONCRETE_BEFORE_TEMPLATED,
    answeredInValues: true,
    document: documentWithPaths({
      "/{entity}/me": [
        {
          name: "entity",
          in: "path",
          required: true,
          style: "simple",
          explode: false,
          schema: STRING,
        },
      ],
      "/t/{id}": [
        { name: "id", in: "path", required: true, style: "simple", explode: false, schema: STRING },
      ],
    }),
    request: request("/t/me"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "competingPath",
    },
    varies: ["two declared templates match the same request"],
    holdsConstant: ["both parameters are simple scalars", "the value is well-formed for both"],
  },
  {
    id: "path-routing-concrete-before-templated-oas31",
    title: "path, a concrete path competing with a templated one",
    inShort:
      "/t/mine matches a literal path and a templated one. The literal wins and requires a " +
      "query parameter the request omits, so the verdict says which path was taken.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PATHS_CONCRETE_BEFORE_TEMPLATED,
      cite.PATH_TEMPLATING_MATCHING,
      cite.PARAMETER_REQUIRED,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "Concrete paths are matched before their templated counterparts, and the " +
      "specification gives exactly this pair as its example. The concrete operation " +
      "requires a query parameter the request does not carry, so matching it correctly " +
      "means rejecting. A library that matched the templated path instead would accept, " +
      "which is why the operations differ in what they require: the verdict alone " +
      "distinguishes them, without needing the value channel. The matching sentences " +
      "carry no RFC 2119 keyword; they are read here as defining what a Paths Object " +
      "means, the way the style tables define serialization without saying MUST.",
    document: documentWithPaths({
      "/t/mine": [{ name: "q", in: "query", required: true, schema: STRING }],
      "/t/{p}": [
        { name: "p", in: "path", required: true, style: "simple", explode: false, schema: STRING },
      ],
    }),
    request: request("/t/mine"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "competingPath",
    },
    varies: ["a concrete path competes with a templated one"],
    holdsConstant: [
      "the request is well-formed for both",
      "one operation each",
      "the path parameter's style is declared",
    ],
  },
  {
    id: "path-routing-identical-templates-oas31",
    title: "path, two templates identical but for the parameter name",
    inShort:
      "Two paths differ only in what their template is named, which the specification " +
      "forbids writing. Whether a validator refuses the document is up to it.",
    tier: "divergence",
    oasVersion: "3.1",
    question:
      "Two templates differ only in what they call their parameter, which the " +
      "specification says MUST NOT exist because they are identical, and names as invalid " +
      "in its own example. That rule is addressed to whoever wrote the document, and " +
      "nothing says what a validator does when handed one. Refusing the document, taking " +
      "the first, and taking the last are each consistent with what is written, and which " +
      "parameter comes back says which was taken.",
    basis: cite.PATH_TEMPLATING_MATCHING,
    answeredInValues: true,
    document: documentWithPaths({
      "/t/{p}": [
        { name: "p", in: "path", required: true, style: "simple", explode: false, schema: STRING },
      ],
      "/t/{q}": [
        { name: "q", in: "path", required: true, style: "simple", explode: false, schema: STRING },
      ],
    }),
    request: request("/t/blue"),
    breaksDocumentRule: {
      citation: cite.PATHS_CONCRETE_BEFORE_TEMPLATED,
      detail:
        "two templated paths share a hierarchy and differ only in parameter name, which " +
        "the specification calls identical and forbids",
      // A relationship between two keys rather than a constraint on either, so
      // the meta-schema validates this document cleanly.
      detectedByMetaSchema: false,
    },
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "scalar",
      probeAxis: "competingPath",
    },
    varies: ["two templates are identical but for the parameter name"],
    holdsConstant: ["the value is well-formed for both", "one operation each"],
  },
  {
    id: "path-simple-array-canonical-oas31",
    title: "path, simple, array, canonical",
    inShort: "A comma-joined array in a plain path segment.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale: "simple is the default path style; an array is comma separated with no prefix.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "simple",
        explode: false,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/blue,black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "simple",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["canonical encoding", "value well-formed", "one parameter declared"],
  },
  {
    id: "path-simple-array-encoded-delimiter-oas31",
    title: "path, simple, array, the delimiter arrives percent-encoded",
    inShort:
      "The comma between two items arrives encoded as %2C, so whether it is a separator or " +
      "part of one value depends on when decoding happens.",
    tier: "divergence",
    oasVersion: "3.1",
    question:
      "A percent-encoded comma sits where the delimiter would be. Is this one item " +
      "containing a comma, or two items? Decoding before splitting and splitting before " +
      "decoding give different answers, and the specification prescribes no order.",
    basis: null,
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "simple",
        explode: false,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/blue%2Cblack"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      schema: "array",
      declaredStyle: "simple",
      declaredExplode: false,
      probeAxis: "encodingVariant",
    },
    varies: ["the encoding of the delimiter"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-array-explode-oas31",
    title: "path, simple, array, explode true",
    inShort:
      "An exploded simple array, which the table spells the same as the unexploded one: " +
      "commas either way.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: ["blue", "black"] },
    rationale:
      "Exploding a simple array changes nothing: the table gives the same wire form " +
      "for both values of explode. So this case and the unexploded one are the same " +
      "bytes with different declarations, and a library that treats explode as " +
      "meaningful here will disagree with one that reads the table.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "simple",
        explode: true,
        schema: STRING_ARRAY,
      },
    ]),
    request: request("/t/blue,black"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "array",
      probeAxis: "canonical",
    },
    varies: ["explode"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-object-canonical-oas31",
    title: "path, simple, object, canonical",
    inShort: "An object in a path segment as R,100,G,200.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "The Style Examples table gives this exact serialization for an object under " +
      "this style and explode, so both the verdict and the deserialized value are " +
      "settled. Object schemas are where the styles differ most from one another.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "simple",
        explode: false,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/R,100,G,200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-object-explode-oas31",
    title: "path, simple, object, explode true",
    inShort:
      "The exploded spelling, R=100,G=200, where explode puts an equals sign between key " +
      "and value.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: { R: "100", G: "200" } },
    rationale:
      "An exploded simple object joins each property to its value with equals, where the " +
      "unexploded row lays the same properties out as a flat comma list.",
    document: document([
      {
        name: "p",
        in: "path",
        required: true,
        style: "simple",
        explode: true,
        schema: STRING_OBJECT,
      },
    ]),
    request: request("/t/R=100,G=200"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "object",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-scalar-canonical-oas31",
    title: "path, simple, scalar, canonical",
    inShort: "The plainest path case: one segment, one value.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "A simple scalar is the value itself, so the wire form and the value are the same " +
      "string. Nothing has to be deserialized for the schema question to be reachable.",
    document: document([
      { name: "p", in: "path", required: true, style: "simple", explode: false, schema: STRING },
    ]),
    request: request("/t/blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      schema: "scalar",
      declaredStyle: "simple",
      declaredExplode: false,
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "value well-formed for its type"],
  },
  {
    id: "path-simple-scalar-explode-oas31",
    title: "path, simple, scalar, explode true",
    inShort: "A path scalar with explode on, which changes nothing for a single value.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "Simple is the defaulted style for a path and a scalar is the bare segment, exploded or " +
      "not. The declared-explode counterpart of the canonical case.",
    document: document([
      { name: "p", in: "path", required: true, style: "simple", explode: true, schema: STRING },
    ]),
    request: request("/t/blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: true,
      declaredStyle: "simple",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-scalar-unset-style-oas31",
    title: "path, scalar, style and explode both left to the default",
    inShort:
      "Sends blue as the path segment with nothing declared about its format, so the path " +
      "default has to be resolved before reading it.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_STYLE, cite.STYLE_EXAMPLE_SIMPLE_NO_EXPLODE],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale:
      "A path parameter with no serialization keywords, which the library must resolve " +
      "to simple before reading the segment. Pairs with the declared-style case on the " +
      "same wire bytes, so the two differ only in whether the default was resolved.",
    document: document([{ name: "p", in: "path", required: true, schema: STRING }]),
    request: request("/t/blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "unset",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: ["style and explode are left to the default"],
    holdsConstant: ["identifier is the declared one", "value well-formed"],
  },
  {
    id: "path-matrix-scalar-wrong-type-oas31",
    title: "path, matrix, scalar, a value well-formed for a different type",
    inShort:
      "The segment says ;p=blue where the schema says integer. The name is inside the " +
      "segment, so the value has to be read out of it before any type can be judged.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [
      cite.PARAMETER_STYLE,
      cite.STYLE_EXAMPLE_MATRIX_NO_EXPLODE,
      cite.PARAMETER_SCHEMA,
      cite.SCHEMA_OBJECT,
      cite.JSON_SCHEMA_DATA_MODEL,
    ],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The parameter is declared as an integer and the value inside the segment is " +
      "alphabetic, so no conversion left to implementations makes it one. The wrong-typed " +
      "sibling in `simple` asks the same question of a segment that is already the value; " +
      "here the matrix syntax has to come off first, which is why a library that leaves " +
      "path style to its caller is not asked this at all. Rejecting `;p=blue` for the " +
      "semicolon would be the right verdict for the wrong reason, and the value channel " +
      "is where the two come apart.",
    document: document([
      { name: "p", in: "path", required: true, style: "matrix", explode: false, schema: INTEGER },
    ]),
    request: request("/t/;p=blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "matrix",
      explode: false,
      schema: "scalar",
      declaredStyle: "matrix",
      declaredExplode: false,
      probeAxis: "wrongTypeValue",
    },
    varies: ["the value is well-formed for a different type"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
  {
    id: "path-simple-scalar-wrong-type-oas31",
    title: "path, simple, scalar, a value well-formed for a different type",
    inShort:
      "The segment says blue where the schema says integer. Letters are not a number under " +
      "any reading, so no leniency about converting text can rescue it.",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [cite.PARAMETER_SCHEMA, cite.SCHEMA_OBJECT, cite.JSON_SCHEMA_DATA_MODEL],
    expected: "rejected",
    expectedValues: null,
    rationale:
      "The parameter is declared as an integer and the value is alphabetic. No conversion " +
      "left to implementations makes this an integer, so the disagreement about coercing " +
      "numeric strings does not reach this case.",
    document: document([
      { name: "p", in: "path", required: true, style: "simple", explode: false, schema: INTEGER },
    ]),
    request: request("/t/blue"),
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      schema: "scalar",
      declaredStyle: "simple",
      declaredExplode: false,
      probeAxis: "wrongTypeValue",
    },
    varies: ["the value is well-formed for a different type"],
    holdsConstant: ["identifier is the declared one", "wire shape matches the declared style"],
  },
];
