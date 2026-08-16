import OpenAPIRequestValidatorModule from "openapi-request-validator";
import type {
  AdapterCapabilities,
  AdapterCase,
  Configuration,
  LibraryAdapter,
} from "../types/adapter";

import type {
  AdapterResult,
  DeserializedValues,
  InputMutation,
  Observation,
} from "../types/result";
import type { WireRequest } from "../types/wire";
import type { JsonValue } from "../types/json";
import type { ParameterObject } from "../types/openapi";
import { toJsonValue } from "../runner/jsonSafe";
import { deepEqual, inputMutation, snapshotInput } from "../container/inputMutation";
import type { PreparsedRequest } from "../wire/preparse";
import { soleTemplate } from "../wire/pathTemplate";
import { readResolution, readVersion } from "./version";

const LIBRARY = "openapi-request-validator";
/** Where this library's source lives. Stated by this container, not resolved. */
const SOURCE =
  "https://github.com/kogosoftwarellc/open-api/tree/master/packages/openapi-request-validator";

const capabilities: AdapterCapabilities = {
  stages: {
    routing: false,
    splitting: { cookie: false, header: false, path: false, query: false },
    styleDeserialization: false,
    contentDeserialization: false,
    schemaValidation: true,
    valueExposure: true,
  },
  oasVersions: { "3.0": true, "3.1": true, "3.2": false },
};

const configuration: Configuration = {
  id: "parameters-only",
  description:
    "new OpenAPIRequestValidator({ parameters }) with the operation's parameters, " +
    "called with { params, query, headers }. Query arrives from the harness as raw " +
    "name/value pairs with no percent decoding, then this adapter collapses duplicate " +
    "raw names into the object shape validateRequest accepts. That shape holds a " +
    "string per name, so a query pair that arrived with no `=` is answered as a case " +
    "this shape cannot represent, rather than as an empty value. It is told which " +
    "operation applies, because it has no routing of its own. " +
    "Values are read from a write-back channel: validateRequest returns errors only, " +
    "and its schema engine writes coerced values and schema defaults onto the params, " +
    "query and headers object it is handed. This adapter reports the declared " +
    "parameters whose values changed across the call, at vantage " +
    "parsedBeforeValidation. An input the library left unchanged reports no values.",
  options: {},
};

interface RequestValidator {
  validateRequest(request: unknown): unknown;
}
type RequestValidatorConstructor = new (args: { parameters?: unknown }) => RequestValidator;

/** Published as a CommonJS default export, which lands differently under ESM. */
const OpenAPIRequestValidator = ((OpenAPIRequestValidatorModule as unknown as { default?: unknown })
  .default ?? OpenAPIRequestValidatorModule) as RequestValidatorConstructor;

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
      _request: WireRequest,
      preparsed: PreparsedRequest | null,
    ): Promise<AdapterResult> {
      const base = {
        library: LIBRARY,
        libraryVersion: readVersion(LIBRARY),
        configurationId: configuration.id,
        preparse: null,
      } as const;

      const pathItem = testCase.document.paths[soleTemplate(testCase.document)];
      const parameters = pathItem?.get?.parameters ?? pathItem?.post?.parameters;

      let validator: RequestValidator;
      try {
        validator = new OpenAPIRequestValidator({ parameters });
      } catch (error) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "libraryInitUnsupported",
          detail: error instanceof Error ? error.message : String(error),
        };
      }

      if (preparsed === null) {
        return {
          ...base,
          outcome: "adapterError",
          detail: "declares preparsed delivery but was given no split",
          raw: null,
        };
      }

      const query = queryRecord(preparsed.query);
      if (query === null && preparsed.query !== null) {
        return {
          ...base,
          outcome: "unsupported",
          reason: "cannotRepresentCase",
          detail:
            "a query pair arrived with no `=`, and the object shape validateRequest " +
            "accepts holds a string per name, so `?p` cannot be spelled apart from " +
            "`?p=`; answering either way would report a verdict on the other request",
        };
      }

      const libraryRequest = {
        params: preparsed.params,
        query,
        headers: preparsed.headers,
      };
      const before = snapshotInput(libraryRequest);

      try {
        const errors = validator.validateRequest(libraryRequest);
        const mutation = inputMutation(
          before,
          libraryRequest,
          "the params, query and headers object handed to validateRequest",
        );
        return {
          ...base,
          outcome: errors === undefined ? "accepted" : "rejected",
          deserialized: deserializedObservation(parameters ?? [], before, libraryRequest, mutation),
          inputMutation: mutation,
          raw: toJsonValue(errors ?? { errors: null }),
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

/** The object handed to validateRequest, which the library mutates in place. */
interface LibraryRequest {
  readonly params: Record<string, string> | null;
  readonly query: Record<string, string | string[]> | null;
  readonly headers: Record<string, string | string[]> | null;
}

/**
 * What the library exposed on this answer, read from the write-back channel.
 *
 * validateRequest returns errors only, so the one place values can come from
 * is the object it was handed: its schema engine coerces values and fills
 * schema defaults in place. Only positions the library demonstrably wrote are
 * reported; echoing untouched input would report this adapter's own preparse
 * as library output. An unchanged input therefore reports `unexposed`, with
 * the detail saying the write-back channel was checked and carried nothing.
 */
function deserializedObservation(
  declared: readonly ParameterObject[],
  before: LibraryRequest,
  after: LibraryRequest,
  mutation: InputMutation,
): Observation<DeserializedValues> {
  const value: Record<string, JsonValue> = {};
  const nativeTypes: Record<string, string> = {};
  for (const parameter of declared) {
    // Cookies are never handed to the library, so there is nothing there for
    // it to write onto.
    if (parameter.in === "cookie") continue;
    const was = atPosition(before, parameter);
    const now = atPosition(after, parameter);
    if (deepEqual(was, now)) continue;
    value[parameter.name] = toJsonValue(now);
    nativeTypes[parameter.name] = Array.isArray(now) ? "Array" : typeof now;
  }
  if (Object.keys(value).length > 0) {
    return { kind: "observed", vantage: "parsedBeforeValidation", value, nativeTypes };
  }
  const base = "reports errors only; no published call returns deserialized values";
  return {
    kind: "unexposed",
    reason:
      mutation.kind === "none"
        ? `${base}, and the library wrote nothing back onto this input`
        : base,
  };
}

/**
 * The value at one declared parameter position. Read as unknown: the library
 * rewrites these slots in place, so after the call they hold whatever its
 * schema engine produced rather than the strings this adapter put there.
 */
function atPosition(request: LibraryRequest, parameter: ParameterObject): unknown {
  // `Object.hasOwn` before reading: a parameter declared as `toString` would
  // otherwise read back the prototype's function and be reported as a value the
  // library produced.
  const record = (holder: Record<string, unknown> | null, key: string): unknown =>
    holder !== null && Object.hasOwn(holder, key) ? holder[key] : undefined;
  if (parameter.in === "path") return record(request.params, parameter.name);
  if (parameter.in === "query") return record(request.query, parameter.name);
  // A location with no slot on this library's request shape has no value to
  // read. Falling through to the headers slot, which is what this did, looked a
  // querystring parameter up among the headers and would have reported a header
  // of the same name as that parameter's value. Cookies already take this exit:
  // the caller skips them before asking.
  if (parameter.in !== "header") return undefined;
  // Preparse folds header names to lower case, so the declared name is folded
  // the same way before lookup.
  return record(request.headers, parameter.name.toLowerCase());
}

/**
 * The harness's query pairs in the object shape `validateRequest` accepts, or
 * `null` where they have no spelling in it.
 *
 * Every value in that object is a string, so a pair that arrived with no `=` at
 * all has nowhere to go: writing `""` would hand the library `?p=` where the
 * request was `?p`, and the row would still read as the library's answer.
 */
function queryRecord(
  query: ReadonlyArray<readonly [name: string, value: string | null]> | null,
): Record<string, string | string[]> | null {
  if (query === null) return null;
  // Collected in a `Map`, then materialised: a parameter named `toString` is a
  // name like any other on the wire, and asking a plain object whether it holds
  // that key answers about its prototype.
  const collected = new Map<string, string | string[]>();
  for (const [name, value] of query) {
    if (value === null) return null;
    const existing = collected.get(name);
    if (existing === undefined) collected.set(name, value);
    else if (Array.isArray(existing)) existing.push(value);
    else collected.set(name, [existing, value]);
  }
  return Object.fromEntries(collected);
}
