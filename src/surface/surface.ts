import type { ParameterLocation, Style } from "../types/openapi";
import type { ProbeAxis, SchemaShape } from "../types/case";

/**
 * The specification surface, enumerated from the specification rather than from
 * the corpus.
 *
 * Generating this from the cases would make the coverage map tautologically
 * complete: every cell filled, because a cell only exists if a case created it.
 * The map is worth having precisely because it can show a hole.
 */

export const LOCATIONS: readonly ParameterLocation[] = ["cookie", "header", "path", "query"];

export const STYLES: readonly Style[] = [
  "deepObject",
  "form",
  "label",
  "matrix",
  "pipeDelimited",
  "simple",
  "spaceDelimited",
];

/**
 * The schema shapes the serialization surface enumerates.
 *
 * The nullable shapes are deliberately absent, and their absence is a judgement
 * worth stating rather than a shortening. This surface maps how a value is
 * written on the wire, and nullability does not affect that: OpenAPI defers to
 * RFC 6570 for which values are undefined, that list includes null, and an
 * undefined variable "has no value and is ignored by the expansion process". A
 * null-valued parameter therefore has no wire form at all, and a non-null value
 * is written exactly the same whether or not the schema also admits null.
 *
 * Enumerating them anyway produced 41 cells whose every case would have carried
 * a wire form character-for-character identical to a cell already filled,
 * differing only by a flag the serialization never sees. That is a coverage
 * number improving while nothing new is measured.
 *
 * Nullability is still worth probing, on its own axis rather than this one:
 * what a library does when a parameter declared nullable receives nothing, an
 * empty value, or the four characters that spell the other admitted type.
 */
export const SCHEMA_SHAPES: readonly SchemaShape[] = ["array", "object", "scalar"];

export const PROBE_AXES: readonly ProbeAxis[] = [
  "canonical",
  "caseVariant",
  "competingParameter",
  "competingPath",
  "declarationFlag",
  "duplicateName",
  "emptyAfterParse",
  "emptyContainer",
  "encodingVariant",
  "foreignName",
  "foreignWireShape",
  "missingName",
  "nameWithoutValue",
  "optionalAbsent",
  "wrongTypeValue",
];

/** Which locations each style is legal in, per the Style Values table. */
const STYLE_LOCATIONS: Record<Style, readonly ParameterLocation[]> = {
  deepObject: ["query"],
  form: ["cookie", "query"],
  label: ["path"],
  matrix: ["path"],
  pipeDelimited: ["query"],
  simple: ["header", "path"],
  spaceDelimited: ["query"],
};

/**
 * Which schema kinds each style is legal for, per the Style Examples table.
 *
 * One table for every specification version on purpose: the 2024 patch
 * releases converged, and 3.0.4's table matches 3.1.1's row for row,
 * including the object columns for spaceDelimited and pipeDelimited that
 * pre-2024 3.0 patches lacked. This corpus builds and cites 3.0.4, so a
 * per-version table here would encode a difference the cited documents do
 * not have. The day a measured version's table genuinely differs, this is
 * the constant to split by version.
 */
const STYLE_SHAPES: Record<Style, readonly ("array" | "object" | "scalar")[]> = {
  deepObject: ["object"],
  form: ["array", "object", "scalar"],
  label: ["array", "object", "scalar"],
  matrix: ["array", "object", "scalar"],
  pipeDelimited: ["array", "object"],
  simple: ["array", "object", "scalar"],
  spaceDelimited: ["array", "object"],
};

function baseShape(shape: SchemaShape): "array" | "object" | "scalar" {
  if (shape === "array" || shape === "nullableArray") return "array";
  if (shape === "object" || shape === "nullableObject") return "object";
  return "scalar";
}

export interface SurfaceCell {
  readonly location: ParameterLocation;
  readonly style: Style;
  readonly explode: boolean;
  readonly schema: SchemaShape;
}

/**
 * True when the combination is legal for the location and type, and is not one
 * the specification marks n/a. A combination the specification calls undefined
 * is not a coverage hole: it is a divergence probe, and it is counted as one.
 */
export function isDefined(cell: SurfaceCell): boolean {
  if (!STYLE_LOCATIONS[cell.style].includes(cell.location)) return false;
  const shape = baseShape(cell.schema);
  if (!STYLE_SHAPES[cell.style].includes(shape)) return false;

  if (cell.style === "deepObject") return cell.explode;
  if (cell.style === "pipeDelimited" || cell.style === "spaceDelimited") return !cell.explode;
  return true;
}

/** Every defined combination, in the order the enumerations are declared. */
export function definedSurface(): readonly SurfaceCell[] {
  const cells: SurfaceCell[] = [];
  for (const location of LOCATIONS) {
    for (const style of STYLES) {
      for (const explode of [false, true]) {
        for (const schema of SCHEMA_SHAPES) {
          const cell = { location, style, explode, schema };
          if (isDefined(cell)) cells.push(cell);
        }
      }
    }
  }
  return cells;
}

// Nullable shapes fold into their base cell: the style tables have no nullable
// row, so a nullable case covers the same specification surface as its base
// shape and is counted there.
export function cellKey(cell: SurfaceCell): string {
  return `${cell.location}|${cell.style}|${String(cell.explode)}|${baseShape(cell.schema)}`;
}

/**
 * The content surface, which the style surface above cannot hold.
 *
 * A parameter declaring `content` has no style and no explode, so it has no
 * coordinates in that table and its cases were invisible to it. Enumerating
 * them here rather than widening that one keeps two things separate that the
 * specification keeps separate: how a value is written under a style, and how a
 * value is written as a representation of a media type.
 *
 * The condition axis is what a style surface has no room for at all. A style
 * cell is filled by a value written in that style; a media type representation
 * can also be a value that is not a representation of it, and what a library
 * does with that is a different question from what it does with a well-formed
 * one. Both are enumerated, so a table showing only the well-formed half cannot
 * read as complete.
 */
/**
 * The types a schema can declare for a value, enumerated from the
 * specification rather than from the corpus.
 *
 * Appendix B names the JSON Schema data model's four primitives: strings,
 * numbers, booleans and null, with `integer` a convenience defined
 * mathematically over numbers. `object` and `array` are containers and the
 * `schema` dimension of the style surface already enumerates them, so they are
 * not repeated here.
 *
 * A separate axis rather than a fifth column on the style surface, for the
 * reason nullability is kept off it: that map is about how a value is written,
 * and the declared type does not change the wire form. Crossing it in would
 * multiply every cell by five and describe no serialization that is not already
 * there.
 *
 * The axis exists because the corpus was blind on it. Every declared type was
 * `string` or `integer` until a count went looking, `boolean` appeared nowhere
 * at all, and nothing in the published map could show that: a map that cannot
 * show a hole is what the coverage rule exists to prevent.
 */
export const DECLARED_TYPES = ["boolean", "integer", "null", "number", "string"] as const;

export type DeclaredType = (typeof DECLARED_TYPES)[number];

export const CONTENT_CONDITIONS = ["malformed", "wellFormed"] as const;

export type ContentCondition = (typeof CONTENT_CONDITIONS)[number];

/**
 * One media type, and the narrowness is published rather than hidden.
 *
 * `application/json` is what the corpus declares today. Enumerating media types
 * this repository has never sent would fill the map with cells whose emptiness
 * says nothing about any library, and leaving the axis out entirely would let
 * the table read as though media type were not a dimension. So the axis exists,
 * holds one value, and the report states that a library's handling of
 * `application/xml` or `text/plain` is unmeasured rather than absent.
 */
export const CONTENT_MEDIA_TYPES: readonly string[] = ["application/json"];

export interface ContentCell {
  readonly location: ParameterLocation;
  readonly mediaType: string;
  readonly schema: SchemaShape;
  readonly condition: ContentCondition;
}

/**
 * Every content combination this surface enumerates.
 *
 * No legality filter, unlike the style surface. The Style Values table marks
 * some style, location and type combinations n/a, and `content` has no such
 * table: the specification permits `content` in any of the four locations and
 * says nothing that rules out a schema shape. An empty cell here is a case
 * nobody has written rather than one the specification excludes.
 */
export function definedContentSurface(): readonly ContentCell[] {
  const cells: ContentCell[] = [];
  for (const location of LOCATIONS) {
    for (const mediaType of CONTENT_MEDIA_TYPES) {
      for (const schema of SCHEMA_SHAPES) {
        for (const condition of CONTENT_CONDITIONS) {
          cells.push({ location, mediaType, schema, condition });
        }
      }
    }
  }
  return cells;
}

export function contentCellKey(cell: ContentCell): string {
  return `${cell.location}|${cell.mediaType}|${cell.schema}|${cell.condition}`;
}
