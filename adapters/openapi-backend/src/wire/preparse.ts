import type { OpenApiDocument } from "../types/openapi";
import type { Preparse } from "../types/result";
import type { SplittableLocation } from "../types/pipeline";
import type { WireRequest } from "../types/wire";
import type { JsonValue } from "../types/json";
import { matchTemplate, templatesOf } from "./pathTemplate";

/**
 * The split the harness performed, per location.
 *
 * `null` for a location means the harness supplied nothing there because the
 * library recovers those values itself.
 */
export interface PreparsedRequest {
  readonly params: Record<string, string> | null;
  readonly query: ReadonlyArray<readonly [name: string, value: string]> | null;
  readonly headers: Record<string, string | string[]> | null;
  readonly cookies: Record<string, string> | null;
}

/** Which locations the harness must split, because the library does not. */
export type DelegatedSplits = Readonly<Record<SplittableLocation, boolean>>;

/**
 * Split a wire request, for the locations a library does not split itself.
 *
 * Deliberately naive, and that is the point. It splits on `/`, the first `?`,
 * `&`, `=` and `;`, and interprets no `style` or percent encoding whatsoever:
 * a path segment and a query value arrive as the raw strings they were on the
 * wire. Anything cleverer here would be the harness writing its own
 * implementation of the serialization rules and then grading libraries against
 * it, which is the one thing this project must not do.
 *
 * Only the delegated locations are filled in. A library that recovers its own
 * path parameters is handed none, so the record attached to its results does
 * not claim otherwise.
 */
export function preparse(
  document: OpenApiDocument,
  request: WireRequest,
  delegated: DelegatedSplits,
): PreparsedRequest {
  const question = request.target.indexOf("?");
  const rawPath = question === -1 ? request.target : request.target.slice(0, question);
  const rawQuery = question === -1 ? "" : request.target.slice(question + 1);

  let query: ReadonlyArray<readonly [name: string, value: string]> | null = null;
  if (delegated.query) {
    query = rawQuery === "" ? [] : rawQuery.split("&").map(splitQueryPair);
  }

  let headers: Record<string, string | string[]> | null = null;
  if (delegated.header) {
    headers = {};
    for (const [name, value] of request.headers) {
      const key = name.toLowerCase();
      const existing = headers[key];
      if (existing === undefined) headers[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else headers[key] = [existing, value];
    }
  }

  let cookies: Record<string, string> | null = null;
  if (delegated.cookie) {
    cookies = {};
    for (const [name, value] of request.headers) {
      if (name.toLowerCase() !== "cookie") continue;
      for (const crumb of value.split(";")) {
        const separator = crumb.indexOf("=");
        if (separator === -1) continue;
        cookies[crumb.slice(0, separator).trim()] = crumb.slice(separator + 1).trim();
      }
    }
  }

  return {
    params: delegated.path ? matchedParams(document, rawPath) : null,
    query,
    headers,
    cookies,
  };
}

/**
 * Path parameters for a library that does not recover its own.
 *
 * Refuses outright when the document declares more than one template. Choosing
 * between them is routing, routing is under measurement, and a harness that
 * picked one would be answering the question on the library's behalf and
 * recording the answer as the library's own. No library in the roster both
 * delegates path splitting and owns routing, so this is a guard against a
 * combination arriving later rather than a branch anyone takes today.
 */
function matchedParams(document: OpenApiDocument, rawPath: string): Record<string, string> {
  const templates = templatesOf(document);
  const only = templates[0];
  if (templates.length !== 1 || only === undefined) {
    throw new Error(
      `cannot supply path parameters for a document declaring ${String(templates.length)} ` +
        "templates: choosing between them is the routing this library delegated, and the " +
        "harness must not answer it",
    );
  }
  return matchTemplate(only, rawPath) ?? {};
}

/** Whether the harness supplied anything at all. */
export function suppliedAnything(preparsed: PreparsedRequest): boolean {
  return (
    preparsed.params !== null ||
    preparsed.query !== null ||
    preparsed.headers !== null ||
    preparsed.cookies !== null
  );
}

/**
 * Record what the harness supplied, and only that.
 *
 * The description names the locations rather than describing a whole-request
 * split, so a cell says what was done for this library rather than what the
 * function is capable of doing.
 */
export function describePreparse(preparsed: PreparsedRequest): Preparse {
  const supplied: string[] = [];
  const result: Record<string, JsonValue> = {};
  if (preparsed.params !== null) {
    supplied.push("path parameters");
    result["params"] = preparsed.params;
  }
  if (preparsed.query !== null) {
    supplied.push("raw query pairs");
    result["query"] = preparsed.query.map(([name, value]) => [name, value]);
  }
  if (preparsed.headers !== null) {
    supplied.push("header names folded and duplicates collected");
    result["headers"] = preparsed.headers;
  }
  if (preparsed.cookies !== null) {
    supplied.push("cookie pairs");
    result["cookies"] = preparsed.cookies;
  }
  return {
    performedBy: "harness",
    description:
      `${supplied.join("; ")}. Split on /, the first ?, &, = and ; with no ` +
      "style interpretation or percent decoding; values passed through raw.",
    result,
  };
}

function splitQueryPair(pair: string): readonly [string, string] {
  const separator = pair.indexOf("=");
  if (separator === -1) return [pair, ""];
  return [pair.slice(0, separator), pair.slice(separator + 1)];
}
