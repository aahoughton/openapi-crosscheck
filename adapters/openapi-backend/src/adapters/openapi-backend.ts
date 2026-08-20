import { OpenAPIBackend } from "openapi-backend";
import type {
  AdapterCapabilities,
  AdapterCase,
  Configuration,
  LibraryAdapter,
} from "../types/adapter";

import type { AdapterResult, DeserializedValues, Observation } from "../types/result";
import type { WireRequest } from "../types/wire";
import type { PreparsedRequest } from "../wire/preparse";
import type { JsonValue } from "../types/json";
import { toJsonValue } from "../runner/jsonSafe";
import { declaredParameters } from "../wire/pathTemplate";
import { inputMutation, snapshotInput } from "../container/inputMutation";
import { observed } from "../container/observe";
import { readResolution, readVersion } from "./version";

const LIBRARY = "openapi-backend";
/** Where this library's source lives. Stated by this container, not resolved. */
const SOURCE = "https://github.com/openapistack/openapi-backend";

const capabilities: AdapterCapabilities = {
  stages: {
    routing: true,
    splitting: { cookie: true, header: false, path: true, query: true },
    styleDeserialization: true,
    contentDeserialization: true,
    schemaValidation: true,
    valueExposure: true,
  },
  oasVersions: { "3.0": true, "3.1": true, "3.2": false },
};

const configuration: Configuration = {
  id: "coerce-types-on",
  description:
    "new OpenAPIBackend({ definition, quick: false, coerceTypes: true }) then init(), " +
    "driven through validateRequest with the raw path and raw query string. " +
    "coerceTypes is enabled because leaving it off rejects every typed parameter; " +
    "both settings were measured and the results were identical for path parameters.",
  options: { quick: false, coerceTypes: true },
};

export function createAdapter(): LibraryAdapter {
  const built = new Map<string, Promise<OpenAPIBackend>>();

  async function build(testCase: AdapterCase): Promise<OpenAPIBackend> {
    const key = JSON.stringify(testCase.document);
    let existing = built.get(key);
    if (existing === undefined) {
      existing = (async () => {
        const api = new OpenAPIBackend({
          definition: testCase.document as never,
          quick: false,
          coerceTypes: true,
        });
        await api.init();
        return api;
      })();
      built.set(key, existing);
    }
    return existing;
  }

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

      let api: OpenAPIBackend;
      try {
        api = await build(testCase);
      } catch (error) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "libraryInitUnsupported",
          detail: error instanceof Error ? error.message : String(error),
        };
      }

      const question = request.target.indexOf("?");
      const path = question === -1 ? request.target : request.target.slice(0, question);
      // `query` is a string here, so a target with no `?` and one with an empty
      // query string both arrive as "". That is the difference a parameter
      // declared `in: "querystring"` exists to read, so a case declaring one is
      // refused rather than answered on a request this shape cannot tell apart.
      if (
        question === -1 &&
        declaredParameters(testCase.document).some((parameter) => parameter.in === "querystring")
      ) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "cannotRepresentCase",
          detail:
            "the request shape takes the query as a string, so a target with no `?` cannot " +
            "be handed over apart from one carrying an empty query string, which is the " +
            "difference a querystring parameter is declared to read",
        };
      }
      const query = question === -1 ? "" : request.target.slice(question + 1);
      const headers = preparsed.headers ?? {};
      const libraryRequest = { method: request.method, path, query, headers };
      const before = snapshotInput(libraryRequest);

      try {
        const result = api.validateRequest(libraryRequest);
        // Compared before the value channel is read, because reading it calls
        // the library again and a second call could write where the first did
        // not, which would report the reading rather than the validation.
        const mutation = inputMutation(
          before,
          libraryRequest,
          "the method, path, query and headers object handed to validateRequest",
        );
        return {
          ...base,
          outcome: result.valid === true ? "accepted" : "rejected",
          deserialized: parsedValues(api, libraryRequest, testCase),
          inputMutation: mutation,
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

function parsedValues(
  api: OpenAPIBackend,
  request: Parameters<OpenAPIBackend["validateRequest"]>[0],
  testCase: AdapterCase,
): Observation<DeserializedValues> {
  try {
    const operation = api.router.matchOperation(request);
    if (operation === undefined) {
      return {
        kind: "notReached",
        reason: "no operation matched, so nothing was parsed",
      };
    }
    const parsed = api.router.parseRequest(request, operation);
    const byLocation: Record<string, Record<string, JsonValue> | undefined> = {
      path: toJsonValue(parsed.params) as Record<string, JsonValue>,
      query: toJsonValue(parsed.query) as Record<string, JsonValue>,
      cookie: toJsonValue(parsed.cookies) as Record<string, JsonValue>,
      header: toJsonValue(parsed.headers) as Record<string, JsonValue>,
    };

    const values: DeserializedValues = {};
    const pathItem = testCase.document.paths[operation.path];
    if (pathItem === undefined) {
      return {
        kind: "notReached",
        reason: `matched ${operation.path}, which the case document does not declare`,
      };
    }
    const declared = pathItem.get?.parameters ?? pathItem.post?.parameters ?? [];
    // A location this library does not parse into a bag has no value to read,
    // and leaving the parameter out of `value` would say the library reported
    // nothing for it. Reported per parameter, so a case declaring one parsed
    // parameter and one unparsed one still publishes the value for the first.
    const unreadable: Record<string, string> = {};
    for (const parameter of declared) {
      if (byLocation[parameter.in] !== undefined) continue;
      unreadable[parameter.name] =
        `this library parses the request into path, query, cookie and header bags, so a ` +
        `parameter declared in ${parameter.in} has no bag to be read from`;
    }
    for (const parameter of declared) {
      const key = parameter.in === "header" ? parameter.name.toLowerCase() : parameter.name;
      const value = byLocation[parameter.in]?.[key];
      if (value !== undefined) values[parameter.name] = value;
    }
    return observed("parsedBeforeValidation", values, unreadable);
  } catch (error) {
    return {
      kind: "notReached",
      reason: `router declined to parse: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
