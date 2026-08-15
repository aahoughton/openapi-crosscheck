import type { OpenApiDocument, ParameterObject } from "../types/openapi";

/** `/t/{p}` -> `/t/:p`, for frameworks that route with colon syntax. */
export function toColonTemplate(template: string): string {
  return template.replace(/\{([^}]+)\}/g, ":$1");
}

/** The single templated path a case declares. Cases declare exactly one. */
/**
 * Every parameter the document declares, across every path and operation.
 *
 * Collected across every path rather than read off a single declared one,
 * because routing cases declare more than one path by construction: matching a
 * request to an operation cannot be probed by a document with only one
 * operation to match.
 *
 * Collecting across paths rather than picking one is what keeps the harness out
 * of the routing decision. Which parameter a library populated is the evidence
 * of which path it matched, and an adapter that picked a path first would have
 * answered the question before the library did.
 *
 * Names are unique within a case by construction: two paths declaring the same
 * parameter name would make the evidence ambiguous, and no case does that.
 */
export function declaredParameters(document: OpenApiDocument): readonly ParameterObject[] {
  const found: ParameterObject[] = [];
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of [pathItem?.get, pathItem?.post]) {
      for (const parameter of operation?.parameters ?? []) found.push(parameter);
    }
  }
  return found;
}

/** Every path template the document declares, in declaration order. */
export function templatesOf(document: OpenApiDocument): readonly string[] {
  return Object.keys(document.paths);
}

/**
 * The one template a case declares, for the code that genuinely needs exactly
 * one and must fail loudly rather than choose.
 */
export function soleTemplate(document: OpenApiDocument): string {
  const templates = Object.keys(document.paths);
  const first = templates[0];
  if (templates.length !== 1 || first === undefined) {
    throw new Error(`case document must declare exactly one path, found ${templates.length}`);
  }
  return first;
}

/**
 * Split a request path against a path template, returning the raw segment for
 * each template variable. No style interpretation happens here: `{p}` matching
 * `;p=1;p=2` yields the string `;p=1;p=2`, semicolons and all.
 *
 * Returns null when the path does not match the template at all.
 */
export function matchTemplate(template: string, path: string): Record<string, string> | null {
  const names: string[] = [];
  const pattern = template
    .split("/")
    .map((segment) => {
      const variable = /^\{([^}]+)\}$/.exec(segment);
      if (variable?.[1] === undefined) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(variable[1]);
      return "([^/]*)";
    })
    .join("/");

  const match = new RegExp(`^${pattern}$`).exec(path);
  if (match === null) return null;

  const params: Record<string, string> = {};
  names.forEach((name, index) => (params[name] = match[index + 1] ?? ""));
  return params;
}
