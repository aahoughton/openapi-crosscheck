import { documentBuilders } from "../../build";
import type { JsonValue } from "../../../types/json";

/**
 * The shared builders, bound to the one `openapi` value every document in this
 * directory carries. Case files import from here rather than from `../../build`
 * so the version is named exactly once for the directory.
 */
export const { document, documentWithPaths } = documentBuilders("3.1.1");

export {
  BOOLEAN,
  INTEGER,
  INTEGER_ARRAY,
  INTEGER_OBJECT,
  MIXED_OBJECT,
  REQUIRED_STRING_OBJECT,
  STRING,
  STRING_ARRAY,
  STRING_OBJECT,
  request,
} from "../../build";

/**
 * A schema admitting a string or null, written the 3.1 way: a type union. The
 * 3.1 Schema Object is a superset of JSON Schema 2020-12, which has no
 * `nullable` keyword.
 */
export const NULLABLE_STRING: JsonValue = { type: ["string", "null"] };
