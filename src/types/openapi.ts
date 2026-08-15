import type { JsonValue } from "./json";

/**
 * Enough of the OpenAPI object model to write parameter cases against, and no
 * more. This is deliberately not a full OpenAPI type: a case declares an
 * operation with a `parameters` list, and everything else is passed through.
 *
 * `parameters` is plural from the start. Two-parameter interference probes (one
 * parameter capturing another's input) are a named part of the coverage floor,
 * so a shape that admits only one parameter would rule them out by construction.
 */
export type OasVersion = "3.0" | "3.1" | "3.2";

/** Every version the protocol knows, for code that must answer about each. */
export const OAS_VERSIONS: readonly OasVersion[] = ["3.0", "3.1", "3.2"];

export type ParameterLocation = "cookie" | "header" | "path" | "query";

export type Style =
  | "deepObject"
  | "form"
  | "label"
  | "matrix"
  | "pipeDelimited"
  | "simple"
  | "spaceDelimited";

/** One representation of a `content`-declared parameter. */
export interface MediaTypeObject {
  readonly schema?: JsonValue;
}

/**
 * `schema` and `content` are both optional here and exactly one is correct.
 *
 * The specification requires one or the other and not both, and the type does
 * not enforce that on purpose: a case declaring both, or neither, is a probe
 * worth running, and a type that made it unrepresentable would rule out the
 * cases that measure what libraries do with a document that breaks the rule.
 */
export interface ParameterObject {
  readonly name: string;
  readonly in: ParameterLocation;
  readonly required?: boolean;
  readonly style?: Style;
  readonly explode?: boolean;
  readonly allowReserved?: boolean;
  readonly allowEmptyValue?: boolean;
  readonly schema?: JsonValue;
  readonly content?: Record<string, MediaTypeObject>;
}

export interface OperationObject {
  readonly operationId?: string;
  readonly parameters?: readonly ParameterObject[];
  readonly responses: Record<string, { readonly description: string }>;
}

export interface PathItemObject {
  readonly get?: OperationObject;
  readonly post?: OperationObject;
}

export interface OpenApiDocument {
  readonly openapi: string;
  readonly info: { readonly title: string; readonly version: string };
  readonly paths: Record<string, PathItemObject>;
}
