import { createValidator, type RequestValues, type ValuesValidator } from "@oaverify/core";
import type {
  AdapterCapabilities,
  AdapterCase,
  Configuration,
  LibraryAdapter,
} from "../types/adapter";

import type { AdapterResult, DeserializedValues, Observation } from "../types/result";
import type { WireRequest } from "../types/wire";
import type { PreparsedRequest } from "../wire/preparse";
import { toJsonValue } from "../runner/jsonSafe";
import { declaredParameters } from "../wire/pathTemplate";
import { observed } from "../container/observe";
import { inputMutation, snapshotInput } from "../container/inputMutation";
import { readResolution, readVersion } from "./version";

const LIBRARY = "@oaverify/core";
/** Where this library's source lives. Stated by this container, not resolved. */
const SOURCE = "https://github.com/oaverify/oaverify";

const capabilities: AdapterCapabilities = {
  stages: {
    routing: true,
    splitting: { cookie: false, header: true, path: true, query: true },
    styleDeserialization: true,
    contentDeserialization: true,
    schemaValidation: true,
    valueExposure: true,
  },
  oasVersions: { "3.0": true, "3.1": true, "3.2": true },
};

const configuration: Configuration = {
  id: "request-return-values",
  description:
    "createValidator(document, { returnValues: true }), driven through " +
    "validateRequest, which the library documents as its per-call HTTP entry point " +
    "and validateFetchRequest as a convenience wrapper over. " +
    "The path is handed over with its query string still in it, because the library " +
    "documents that it reads the query out of the path when the query field is unset, " +
    "so splitting the query stays its work. Headers are handed over as its request " +
    "shape spells them, one entry per name with repeats collected, and with their case " +
    "as the wire carried it, so matching a header name to the declaration stays its " +
    "work too. Cookies are the harness's split, which this configuration declares, and " +
    "the request shape holds one string per cookie name, so a case sending a name twice " +
    "or a crumb with no `=` is answered as a case this shape cannot represent, rather " +
    "than on what survived. " +
    "Reading its values: the library documents that a parameter appears in the " +
    "value channel when this call reached it, deserialized it, and its schema " +
    "accepted the result. So an empty value cell on a rejected row means the " +
    "parameter did not pass, which is a different fact from a library that " +
    "reports a coerced value alongside its own rejection.",
  options: { returnValues: true },
};

export function createAdapter(): LibraryAdapter {
  return {
    library: LIBRARY,
    libraryVersion: readVersion(LIBRARY),
    librarySource: SOURCE,
    libraryResolution: readResolution(LIBRARY),
    capabilities,
    configuration,

    async run(
      testCase: AdapterCase,
      request: WireRequest,
      preparsed: PreparsedRequest,
    ): Promise<AdapterResult> {
      const base = {
        library: LIBRARY,
        libraryVersion: readVersion(LIBRARY),
        configurationId: configuration.id,
        preparse: null,
      } as const;

      let validator: ValuesValidator;
      try {
        validator = createValidator(testCase.document as never, { returnValues: true });
      } catch (error) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "libraryInitUnsupported",
          detail: error instanceof Error ? error.message : String(error),
        };
      }

      const cookies = cookieMap(preparsed.cookies ?? []);
      if (cookies === null) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "cannotRepresentCase",
          detail:
            "the request shape holds one string per cookie name, so neither a repeated " +
            "name nor a crumb that carried no `=` has a spelling in it; handing over " +
            "what survived would put the library's verdict on an input the case did " +
            "not send",
        };
      }

      const libraryRequest = {
        method: request.method,
        path: request.target,
        headers: headerMap(request),
        cookies,
      };
      const before = snapshotInput(libraryRequest);

      try {
        const result = validator.validateRequest(libraryRequest);
        return {
          ...base,
          outcome: result.valid === true ? "accepted" : "rejected",
          deserialized: observation(testCase, result.value),
          inputMutation: inputMutation(
            before,
            libraryRequest,
            "the method, path, headers and cookies object handed to validateRequest",
          ),
          raw: toJsonValue(result),
        };
      } catch (error) {
        return {
          ...base,
          outcome: "libraryError",
          detail: error instanceof Error ? error.message : String(error),
          raw: toJsonValue(error),
        };
      }
    },
  };
}

/**
 * The wire's header list as this library's request shape spells it.
 *
 * Case is left exactly as the request carried it, and a name that repeats
 * becomes an array rather than one joined string. Both are load-bearing:
 * folding case here would answer the case-variant probe on the library's
 * behalf, and joining repeats would answer the duplicate-name probe. Neither is
 * this container's to answer.
 *
 * `Host` goes through like any other header. It is not a parameter in any case
 * and the library has no reason to read it.
 */
function headerMap(request: WireRequest): Record<string, string | string[]> {
  // Collected in a `Map`, then materialised. A header named `toString` is a
  // name like any other on the wire, and asking a plain object whether it holds
  // that key answers about its prototype instead.
  const headers = new Map<string, string | string[]>();
  for (const [name, value] of request.headers) {
    const existing = headers.get(name);
    if (existing === undefined) headers.set(name, value);
    else if (Array.isArray(existing)) existing.push(value);
    else headers.set(name, [existing, value]);
  }
  return Object.fromEntries(headers);
}

/**
 * The harness's cookie pairs as this library's request shape spells them, or
 * `null` when they cannot be spelled at all.
 *
 * `cookies` is `Record<string, string>` here, one value per name, while
 * `headers` and `query` take an array too. So a repeated cookie name has
 * nowhere to go, and picking one crumb would hand the library a request the
 * case did not send while the row still read as its answer.
 */
function cookieMap(
  pairs: ReadonlyArray<readonly [name: string, value: string | null]>,
): Record<string, string> | null {
  // A `Map` rather than the record being built: a cookie named `toString` is a
  // name like any other on the wire, and asking a plain object whether it holds
  // that key answers about its prototype.
  const cookies = new Map<string, string>();
  for (const [name, value] of pairs) {
    // A crumb that carried no `=` has no spelling here either: every value in
    // this record is a string, so `p` would go in as `p=`.
    if (value === null) return null;
    if (cookies.has(name)) return null;
    cookies.set(name, value);
  }
  return Object.fromEntries(cookies);
}

/**
 * The value channel, or a statement that this container cannot read it.
 *
 * A location this library has no bag for is not a parameter that came back
 * empty, and publishing `observed` with the parameter missing says the second.
 * `querystring` is the live instance: this library's returned values are keyed
 * by the four locations it knows, so a querystring parameter has nowhere to be
 * read from, and a case whose whole question is the value would have published
 * an empty value cell as the library's answer.
 *
 * Skipping it silently was worse than the fallthrough it replaced. The
 * fallthrough read the cookies bag and could invent a value; the skip published
 * a hole that reads as the library returning nothing.
 */
function observation(
  testCase: AdapterCase,
  values: RequestValues,
): Observation<DeserializedValues> {
  const unreadable = declaredParameters(testCase.document).filter(
    (parameter) =>
      parameter.in !== "path" &&
      parameter.in !== "query" &&
      parameter.in !== "header" &&
      parameter.in !== "cookie",
  );
  if (unreadable.length > 0) {
    const locations = [...new Set(unreadable.map((parameter) => parameter.in))].sort().join(", ");
    return {
      kind: "unexposed",
      reason:
        `this library's returned values are keyed by path, query, header and cookie, so a ` +
        `parameter declared in ${locations} has no slot to be read from; reporting the rest ` +
        `would publish an empty value cell as this library's answer`,
    };
  }
  return observed("validatedOnly", returnedValues(testCase, values));
}

function returnedValues(testCase: AdapterCase, values: RequestValues): DeserializedValues {
  const returned: DeserializedValues = {};

  for (const parameter of declaredParameters(testCase.document)) {
    if (
      parameter.in !== "path" &&
      parameter.in !== "query" &&
      parameter.in !== "header" &&
      parameter.in !== "cookie"
    ) {
      continue;
    }
    const source =
      parameter.in === "path"
        ? values.path
        : parameter.in === "query"
          ? values.query
          : parameter.in === "header"
            ? values.headers
            : values.cookies;
    // Own properties only: a parameter declared as `toString` would otherwise
    // read back the prototype's function and be reported as a returned value.
    // A key the library left `undefined` is still skipped, because a value cell
    // reading null and one reading nothing are different facts about it.
    if (!Object.hasOwn(source, parameter.name)) continue;
    const value = source[parameter.name];
    if (value !== undefined) returned[parameter.name] = toJsonValue(value);
  }
  return returned;
}
