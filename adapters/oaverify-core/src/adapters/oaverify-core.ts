import { createValidator, type RequestValues, type ValuesValidator } from "@oaverify/core";
import type {
  AdapterCapabilities,
  AdapterCase,
  Configuration,
  LibraryAdapter,
} from "../types/adapter";

import type { AdapterResult, DeserializedValues } from "../types/result";
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
  oasVersions: { "3.0": true, "3.1": true, "3.2": false },
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
    "work too. Cookies are the harness's split, which this configuration declares. " +
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

      const libraryRequest = {
        method: request.method,
        path: request.target,
        headers: headerMap(request),
        cookies: preparsed.cookies ?? {},
      };
      const before = snapshotInput(libraryRequest);

      try {
        const result = validator.validateRequest(libraryRequest);
        return {
          ...base,
          outcome: result.valid === true ? "accepted" : "rejected",
          deserialized: observed("validatedOnly", returnedValues(testCase, result.value)),
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
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of request.headers) {
    const existing = headers[name];
    if (existing === undefined) headers[name] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else headers[name] = [existing, value];
  }
  return headers;
}

function returnedValues(testCase: AdapterCase, values: RequestValues): DeserializedValues {
  const returned: DeserializedValues = {};

  for (const parameter of declaredParameters(testCase.document)) {
    const source =
      parameter.in === "path"
        ? values.path
        : parameter.in === "query"
          ? values.query
          : parameter.in === "header"
            ? values.headers
            : values.cookies;
    const value = source[parameter.name];
    if (value !== undefined) returned[parameter.name] = toJsonValue(value);
  }
  return returned;
}
