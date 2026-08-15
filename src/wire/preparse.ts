import type { OpenApiDocument } from "../types/openapi";
import type { Preparse } from "../types/result";
import type { SplittableLocation } from "../types/pipeline";
import type { WireRequest } from "../types/wire";
import type { JsonValue } from "../types/json";
import { matchTemplate, templatesOf } from "./pathTemplate";

/**
 * The split the harness performed, per location.
 *
 * `null` for a location means the harness supplied nothing there, because the
 * library recovers those values itself. That distinction is the whole point of
 * this shape: a single record covering every location claims the harness did
 * work it may not have done, and a reader checking whether a path result was
 * really the library's would discount it wrongly.
 */
export interface PreparsedRequest {
  readonly params: Record<string, string> | null;
  readonly query: ReadonlyArray<readonly [name: string, value: string | null]> | null;
  readonly headers: Record<string, string | string[]> | null;
  readonly cookies: ReadonlyArray<readonly [name: string, value: string | null]> | null;
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

  let query: ReadonlyArray<readonly [name: string, value: string | null]> | null = null;
  if (delegated.query) {
    query = rawQuery === "" ? [] : rawQuery.split("&").map(splitQueryPair);
  }

  let headers: Record<string, string | string[]> | null = null;
  if (delegated.header) {
    // Accumulated in a `Map` and materialised at the end. A header name is
    // whatever the wire carried, including `toString`, and asking a plain
    // object whether it holds that key answers about its prototype: the fold
    // would report a duplicate of a header that arrived once. `fromEntries`
    // defines own properties, so a name of `__proto__` is a name here too
    // rather than an assignment that sets the prototype and loses the value.
    const folded = new Map<string, string | string[]>();
    for (const [name, value] of request.headers) {
      const key = name.toLowerCase();
      const existing = folded.get(key);
      if (existing === undefined) folded.set(key, value);
      else if (Array.isArray(existing)) existing.push(value);
      else folded.set(key, [existing, value]);
    }
    headers = Object.fromEntries(folded);
  }

  let cookies: ReadonlyArray<readonly [name: string, value: string | null]> | null = null;
  if (delegated.cookie) {
    const crumbs: (readonly [name: string, value: string | null])[] = [];
    for (const [name, value] of request.headers) {
      if (name.toLowerCase() !== "cookie") continue;
      for (const crumb of value.split(";")) {
        const pair = splitCookieCrumb(crumb);
        if (pair !== null) crumbs.push(pair);
      }
    }
    cookies = crumbs;
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
    supplied.push("raw cookie pairs");
    result["cookies"] = preparsed.cookies.map(([name, value]) => [name, value]);
  }
  return {
    performedBy: "harness",
    description:
      `${supplied.join("; ")}. Split on /, the first ?, &, = and ; with no ` +
      "style interpretation or percent decoding; values passed through raw.",
    result,
  };
}

/**
 * One `Cookie` crumb, as a name and a raw value.
 *
 * The delimiter between crumbs is a semicolon and the space that may follow it,
 * so that leading space is dropped and nothing else is. The value keeps every
 * byte it had on the wire, including whitespace inside or after it: what a
 * library does with a padded cookie value is the library's answer to give.
 *
 * A crumb carrying no `=` gets a `null` value, the same as a query pair that
 * carried none. `p` and `p=` are different crumbs, and dropping the first would
 * decide on the container's behalf that its library sees nothing there.
 *
 * A crumb with nothing in it at all, which is what a trailing semicolon leaves,
 * names no cookie and is dropped.
 */
function splitCookieCrumb(crumb: string): readonly [name: string, value: string | null] | null {
  let start = 0;
  while (start < crumb.length && (crumb[start] === " " || crumb[start] === "\t")) start += 1;
  const rest = crumb.slice(start);
  // Nothing at all between two semicolons, which names no cookie to report.
  if (rest === "") return null;
  const separator = rest.indexOf("=");
  if (separator === -1) return [rest, null];
  return [rest.slice(0, separator), rest.slice(separator + 1)];
}

/**
 * One query pair, as a name and a raw value.
 *
 * `null` where the pair carried no `=` at all. `?p` and `?p=` are different
 * requests: one sends a name with no value, the other sends an empty one, and
 * whether a library treats them alike is its answer to give rather than a
 * distinction to lose on the way in.
 */
function splitQueryPair(pair: string): readonly [name: string, value: string | null] {
  const separator = pair.indexOf("=");
  if (separator === -1) return [pair, null];
  return [pair.slice(0, separator), pair.slice(separator + 1)];
}
