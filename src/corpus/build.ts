import type { JsonValue } from "../types/json";
import type { OpenApiDocument, ParameterObject } from "../types/openapi";
import type { WireRequest } from "../types/wire";

/**
 * Document builders bound to one `openapi` version string.
 *
 * Each version directory under `cases/` instantiates this once in a `build.ts`
 * of its own and its case files import from there, so the version a document
 * carries is named exactly once per directory and no builder assumes one.
 */
export function documentBuilders(openapi: string): {
  document: (parameters: readonly ParameterObject[], template?: string) => OpenApiDocument;
  documentWithPaths: (
    paths: Readonly<Record<string, readonly ParameterObject[]>>,
  ) => OpenApiDocument;
} {
  /** A minimal document declaring one operation with the given parameters. */
  function document(parameters: readonly ParameterObject[], template = "/t/{p}"): OpenApiDocument {
    return {
      openapi,
      info: { title: "crosscheck", version: "1" },
      paths: {
        [template]: {
          get: {
            operationId: "probe",
            parameters,
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
  }

  /**
   * A document declaring several paths, for cases about matching a request to
   * an operation. Every other case declares one, because every other case is
   * about what happens once the operation is already known.
   */
  function documentWithPaths(
    paths: Readonly<Record<string, readonly ParameterObject[]>>,
  ): OpenApiDocument {
    return {
      openapi,
      info: { title: "crosscheck", version: "1" },
      paths: Object.fromEntries(
        Object.entries(paths).map(([template, parameters]) => [
          template,
          {
            get: {
              operationId: `probe-${template}`,
              parameters,
              responses: { "200": { description: "ok" } },
            },
          },
        ]),
      ),
    };
  }

  return { document, documentWithPaths };
}

export function request(
  target: string,
  headers: ReadonlyArray<[string, string]> = [],
): WireRequest {
  return { method: "GET", target, headers: [["Host", "harness.invalid"], ...headers] };
}

export const STRING: JsonValue = { type: "string" };
/**
 * A schema admitting a string or null, written the 3.1 way.
 *
 * OpenAPI 3.1 is a superset of JSON Schema 2020-12, where nullability is a type
 * union rather than the separate `nullable` keyword 3.0 used.
 */
export const NULLABLE_STRING: JsonValue = { type: ["string", "null"] };
export const INTEGER: JsonValue = { type: "integer" };
export const BOOLEAN: JsonValue = { type: "boolean" };
export const STRING_ARRAY: JsonValue = { type: "array", items: { type: "string" } };
export const INTEGER_ARRAY: JsonValue = { type: "array", items: { type: "integer" } };
/** An object whose properties are not all strings, for property-level type probes. */
export const MIXED_OBJECT: JsonValue = {
  type: "object",
  properties: { R: { type: "integer" }, G: { type: "string" } },
};

/** An object whose properties are all numeric, for the object half of the coercion probe. */
export const INTEGER_OBJECT: JsonValue = {
  type: "object",
  properties: { R: { type: "integer" }, G: { type: "integer" } },
};

export const STRING_OBJECT: JsonValue = {
  type: "object",
  properties: { R: { type: "string" }, G: { type: "string" } },
};

/**
 * STRING_OBJECT with both properties required, for absence probes.
 *
 * Without `required`, the empty object validates, and RFC 6570 Section 2.3
 * (which Appendix B incorporates) treats a zero-member associative array as
 * undefined, expanding to nothing. An absent exploded object would then be a
 * legitimate serialization of a schema-valid value, and rejecting it would not
 * be settled. Requiring the properties closes that reading.
 */
export const REQUIRED_STRING_OBJECT: JsonValue = {
  type: "object",
  properties: { R: { type: "string" }, G: { type: "string" } },
  required: ["R", "G"],
};
