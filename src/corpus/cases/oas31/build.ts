import { documentBuilders } from "../../build";

/**
 * The shared builders, bound to the one `openapi` value every document in this
 * directory carries. Case files import from here rather than from `../../build`
 * so the version is named exactly once for the directory.
 */
export const { document, documentWithPaths } = documentBuilders("3.1.0");

export {
  BOOLEAN,
  INTEGER,
  INTEGER_ARRAY,
  INTEGER_OBJECT,
  MIXED_OBJECT,
  NULLABLE_STRING,
  REQUIRED_STRING_OBJECT,
  STRING,
  STRING_ARRAY,
  STRING_OBJECT,
  request,
} from "../../build";
