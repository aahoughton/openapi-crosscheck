import type { OasVersion, ParameterLocation, Style } from "../types/openapi";
import type { ProbeAxis, SchemaShape } from "../types/case";

/**
 * The specification surface, enumerated from the specification rather than from
 * the corpus.
 *
 * Generating this from the cases would make the coverage map tautologically
 * complete: every cell filled, because a cell only exists if a case created it.
 * The map is worth having precisely because it can show a hole.
 */

/**
 * Every location any measured version defines.
 *
 * `querystring` is 3.2-only and this list does not say so, the same way it does
 * not say the `cookie` style is 3.2-only. Which locations a version defines is
 * what `isDefined` and `CONTENT_LOCATIONS` answer, per version, and the
 * coverage map is drawn from those rather than from this list.
 */
export const LOCATIONS: readonly ParameterLocation[] = [
  "cookie",
  "header",
  "path",
  "query",
  "querystring",
];

export const STYLES: readonly Style[] = [
  "cookie",
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

/**
 * Which locations each style is legal in, per each version's Style Values
 * table.
 *
 * 3.0.4 and 3.1.1 share a table, so they share an entry here rather than
 * carrying two transcriptions of one thing that could drift apart. 3.2.0 adds
 * a row: `cookie`, legal in `cookie` alone. A style a version does not define
 * has no legal location in it, which is what an empty list says, and is why a
 * cookie-style case cannot land in the 3.1 surface by accident.
 */
const STYLE_LOCATIONS_THROUGH_3_1: Record<Style, readonly ParameterLocation[]> = {
  cookie: [],
  deepObject: ["query"],
  form: ["cookie", "query"],
  label: ["path"],
  matrix: ["path"],
  pipeDelimited: ["query"],
  simple: ["header", "path"],
  spaceDelimited: ["query"],
};

const STYLE_LOCATIONS: Record<OasVersion, Record<Style, readonly ParameterLocation[]>> = {
  "3.0": STYLE_LOCATIONS_THROUGH_3_1,
  "3.1": STYLE_LOCATIONS_THROUGH_3_1,
  "3.2": { ...STYLE_LOCATIONS_THROUGH_3_1, cookie: ["cookie"] },
};

/**
 * Which schema kinds each style is legal for, per the Style Examples table.
 *
 * 3.0.4 and 3.1.1 share a table: the 2024 patch releases converged, and
 * 3.0.4's table matches 3.1.1's row for row, including the object columns for
 * spaceDelimited and pipeDelimited that pre-2024 3.0 patches lacked. 3.2.0 is
 * where a measured version's table genuinely differs, and it differs by
 * addition: a `cookie` row for primitive, array and object.
 */
const STYLE_SHAPES_THROUGH_3_1: Record<Style, readonly ("array" | "object" | "scalar")[]> = {
  cookie: [],
  deepObject: ["object"],
  form: ["array", "object", "scalar"],
  label: ["array", "object", "scalar"],
  matrix: ["array", "object", "scalar"],
  pipeDelimited: ["array", "object"],
  simple: ["array", "object", "scalar"],
  spaceDelimited: ["array", "object"],
};

const STYLE_SHAPES: Record<
  OasVersion,
  Record<Style, readonly ("array" | "object" | "scalar")[]>
> = {
  "3.0": STYLE_SHAPES_THROUGH_3_1,
  "3.1": STYLE_SHAPES_THROUGH_3_1,
  "3.2": { ...STYLE_SHAPES_THROUGH_3_1, cookie: ["array", "object", "scalar"] },
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
 * True when the combination is legal for the location and type in that version,
 * and is not one that version marks n/a. A combination the specification calls
 * undefined is not a coverage hole: it is a divergence probe, and it is counted
 * as one.
 *
 * The version is required rather than defaulted. A caller who does not say
 * which specification they mean is asking a question with no answer, and a
 * default would answer it silently with whichever version this file was written
 * against.
 *
 * `deepObject` is where the versions part company. Through 3.1 the combination
 * with explode false is named undefined, so only the exploded cell is on the
 * surface. 3.2 says explode has no effect for deepObject, which puts both cells
 * on the surface and makes each one a case worth writing: a library that
 * branches on the flag answers the two differently, and one cell could not show
 * that.
 *
 * So `n/a` in a 3.2 style table is read two ways here, and the difference is in
 * the specification rather than in this function. For `pipeDelimited` and
 * `spaceDelimited` the explode column is the only thing marking the exploded
 * combination, and the table's preamble calls a combination marked n/a
 * undefined, so the cell leaves the surface. For `deepObject` the explode
 * field's own text says the flag has no effect, which settles the behavior of
 * both values rather than leaving either undefined; the table's single row is
 * then one row because the flag does not select between rows. A cell whose
 * behavior the specification states is on the surface however the table spells
 * it, which is why the 3.2 denominator is 48 rather than 47.
 */
export function isDefined(cell: SurfaceCell, version: OasVersion): boolean {
  // A querystring parameter has no cell on this surface in any version, and the
  // specification says so twice: it MUST be specified using `content`, and the
  // fields for use with `schema`, `style` and `explode` among them, "MUST NOT be
  // used with `in: "querystring"`". Stated here rather than left to fall out of
  // no style listing the location, so that a later edit to the style tables
  // cannot admit a cell whose every case the meta-schema rejects.
  if (cell.location === "querystring") return false;
  if (!STYLE_LOCATIONS[version][cell.style].includes(cell.location)) return false;
  const shape = baseShape(cell.schema);
  if (!STYLE_SHAPES[version][cell.style].includes(shape)) return false;

  if (cell.style === "deepObject") return version === "3.2" || cell.explode;
  if (cell.style === "pipeDelimited" || cell.style === "spaceDelimited") return !cell.explode;
  return true;
}

/** Every combination one version defines, in the order the enumerations are declared. */
export function definedSurface(version: OasVersion): readonly SurfaceCell[] {
  const cells: SurfaceCell[] = [];
  for (const location of LOCATIONS) {
    for (const style of STYLES) {
      for (const explode of [false, true]) {
        for (const schema of SCHEMA_SHAPES) {
          const cell = { location, style, explode, schema };
          if (isDefined(cell, version)) cells.push(cell);
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
 * The media types the corpus declares, and the narrowness is published rather
 * than hidden.
 *
 * A media type enters this list when the corpus sends it. Enumerating ones this
 * repository has never sent would fill the map with cells whose emptiness says
 * nothing about any library, and leaving the axis out entirely would let the
 * table read as though media type were not a dimension. So the axis holds what
 * is sent, and the report states that a library's handling of
 * `application/xml` or `text/plain` is unmeasured rather than absent.
 *
 * `application/x-www-form-urlencoded` entered with the querystring cases, and
 * in that order: the cases were promoted first, then the member added here.
 * Adding it first would have published a denominator counting cells for a
 * representation this repository had never sent, and told the coverage pages
 * the corpus declares it.
 *
 * 3.2 pairs that media type with `in: "querystring"`, and the two canonical
 * querystring cases are written twice, once under each media type. A library
 * that rejects one and accepts the other has named its own reason, where a
 * single case would leave the location and the media type sharing one verdict
 * between them.
 *
 * The cost is a denominator that roughly doubled: this axis multiplies every
 * location in every version, so 78 defined cells became 156, and almost all of
 * the new ones are empty. Those cells were unmeasured either way, and the
 * change is that a reader can see it. That was the argument for paying it.
 */
export const CONTENT_MEDIA_TYPES: readonly string[] = [
  "application/json",
  "application/x-www-form-urlencoded",
];

/**
 * Which locations `content` is a question for, per version.
 *
 * The four locations every measured version defines, plus `querystring` in
 * 3.2, which is the version that defines it. A parameter there MUST be declared
 * with `content`, so it appears on this surface and on no other.
 */
const CONTENT_LOCATIONS: Readonly<Record<OasVersion, readonly ParameterLocation[]>> = {
  "3.0": ["cookie", "header", "path", "query"],
  "3.1": ["cookie", "header", "path", "query"],
  "3.2": ["cookie", "header", "path", "query", "querystring"],
};

export interface ContentCell {
  readonly location: ParameterLocation;
  readonly mediaType: string;
  readonly schema: SchemaShape;
  readonly condition: ContentCondition;
}

/**
 * Every content combination this surface enumerates.
 *
 * Almost no legality filter, unlike the style surface. The Style Values table
 * marks some style, location and type combinations n/a, and `content` has no
 * such table: the specification permits `content` in every location it defines
 * and says nothing that rules out a schema shape or a media type. An empty cell
 * here is a case nobody has written rather than one the specification excludes.
 *
 * The one filter is which locations a version defines at all, which is why this
 * takes a version. A 3.1 document cannot declare `in: "querystring"`, so a
 * querystring cell under 3.1 would be a hole nobody can fill rather than one
 * nobody has filled, and the two must not count the same.
 */
export function definedContentSurface(version: OasVersion): readonly ContentCell[] {
  const cells: ContentCell[] = [];
  for (const location of CONTENT_LOCATIONS[version]) {
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
