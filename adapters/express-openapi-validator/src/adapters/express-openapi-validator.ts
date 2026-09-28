import express from "express";
import type { Server } from "node:http";
import * as OpenApiValidator from "express-openapi-validator";
import type {
  AdapterCapabilities,
  AdapterCase,
  Configuration,
  LibraryAdapter,
} from "../types/adapter";

import type { AdapterResult, DeserializedValues, Observation, ValueVantage } from "../types/result";
import type { JsonValue } from "../types/json";
import type { WireRequest } from "../types/wire";
import type { PreparsedRequest } from "../wire/preparse";
import { toJsonValue } from "../runner/jsonSafe";
import { sendRaw } from "../wire/http";
import { declaredParameters, templatesOf, toColonTemplate } from "../wire/pathTemplate";
import { observed } from "../container/observe";
import { readResolution, readVersion } from "./version";

const LIBRARY = "express-openapi-validator";
/** Where this library's source lives. Stated by this container, not resolved. */
const SOURCE = "https://github.com/cdimascio/express-openapi-validator";

const capabilities: AdapterCapabilities = {
  stages: {
    routing: true,
    splitting: { cookie: false, header: true, path: true, query: true },
    styleDeserialization: true,
    contentDeserialization: true,
    schemaValidation: true,
    valueExposure: true,
  },
  queryPairInput: "notUsed",
  oasVersions: { "3.0": true, "3.1": true, "3.2": false },
};

const configuration: Configuration = {
  id: "middleware-validate-requests",
  description:
    "OpenApiValidator.middleware({ apiSpec, validateRequests: true }) mounted on an " +
    "express app, exactly as the published usage shows, with a handler that echoes " +
    "the request it received and an error handler that reports the thrown status " +
    "alongside the same request fields. " +
    "Query and header splitting are the host stack's: express (version in options) " +
    "parses the query string with its default parser and Node joins repeated header " +
    "lines with a comma and a space before the middleware reads either. " +
    "Cookies reach it the way the published usage expects, as req.cookies: a " +
    "middleware ahead of the validator installs the harness's cookie pairs there, " +
    "in the place a cookie parser would. A repeated cookie name or a crumb with no " +
    "`=` has no spelling in that record and is answered as a case it cannot carry. " +
    "Reading its values: on an accepted request they are what the handler was " +
    "handed. On a rejected one they are what the middleware had coerced onto the " +
    "request before it stopped, so they are partial and stop at the first failure.",
  options: { validateRequests: true, express: readVersion("express") },
};

interface Mounted {
  readonly server: Server;
  readonly port: number;
}

export function createAdapter(): LibraryAdapter {
  const mounted = new Map<string, Promise<Mounted>>();
  // The cookies the next request should carry as req.cookies. Runs are
  // serialised through `queue`, so exactly one request is in flight when the
  // middleware reads this.
  let pendingCookies: Record<string, string> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  async function mount(testCase: AdapterCase): Promise<Mounted> {
    const key = JSON.stringify(testCase.document);
    let existing = mounted.get(key);
    if (existing === undefined) {
      existing = start(testCase);
      mounted.set(key, existing);
    }
    return existing;
  }

  async function start(testCase: AdapterCase): Promise<Mounted> {
    const app = express();
    app.use((req, _res, next) => {
      if (pendingCookies !== undefined) {
        (req as express.Request & { cookies?: Record<string, string> }).cookies = {
          ...pendingCookies,
        };
      }
      next();
    });
    app.use(
      OpenApiValidator.middleware({
        apiSpec: testCase.document as never,
        validateRequests: true,
      }),
    );
    for (const template of templatesOf(testCase.document)) {
      app.all(toColonTemplate(template), (req, res) => {
        res.status(200).json({
          params: req.params,
          query: req.query,
          headers: req.headers,
          cookies: cookiesOf(req),
        });
      });
    }
    app.use(
      (
        error: { status?: number; message?: string; errors?: unknown },
        req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        res.status(error.status ?? 500).json({
          message: error.message,
          errors: error.errors ?? null,
          // Express resets req.params for an error-handling layer, so the path
          // values the middleware parsed are read from req.openapi, where it
          // records them, rather than lost on every rejection.
          params: openapiPathParams(req) ?? req.params,
          query: req.query,
          headers: req.headers,
          cookies: cookiesOf(req),
        });
      },
    );

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port bound");

    // The middleware loads the document on the first request rather than when
    // it is installed, so a document it refuses would otherwise surface as a
    // 5xx on the case's own request and read as the library raising on that
    // request. A path no case declares answers 404 once the document loaded;
    // a 5xx there is the refusal, reported as libraryInitUnsupported like
    // every container whose library refuses a document at construction.
    const preflight = await sendRaw(address.port, {
      method: "GET",
      target: PREFLIGHT_PATH,
      headers: [["Host", "harness.invalid"]],
    });
    if (preflight.status >= 500) {
      server.close();
      const body = parseBody(preflight.body) as { message?: unknown };
      throw new Error(
        typeof body === "object" && body !== null && typeof body.message === "string"
          ? body.message
          : `the app answered ${String(preflight.status)} before any case request`,
      );
    }
    return { server, port: address.port };
  }

  return {
    library: LIBRARY,
    libraryVersion: readVersion(LIBRARY),
    librarySource: SOURCE,
    libraryResolution: readResolution(LIBRARY),
    capabilities,
    configuration,

    run(
      testCase: AdapterCase,
      request: WireRequest,
      preparsed: PreparsedRequest | null,
    ): Promise<AdapterResult> {
      const next = queue.then(() => runOne(testCase, request, preparsed));
      queue = next.catch(() => undefined);
      return next;
    },

    async dispose(): Promise<void> {
      for (const pending of mounted.values()) {
        const { server } = await pending;
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      mounted.clear();
    },
  };

  async function runOne(
    testCase: AdapterCase,
    request: WireRequest,
    preparsed: PreparsedRequest | null,
  ): Promise<AdapterResult> {
    const base = {
      library: LIBRARY,
      libraryVersion: readVersion(LIBRARY),
      configurationId: configuration.id,
      preparse: null,
    } as const;

    let target: Mounted;
    try {
      target = await mount(testCase);
    } catch (error) {
      return {
        ...base,
        outcome: "unsupported",
        reason: "libraryInitUnsupported",
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    const cookies = cookieRecord(preparsed?.cookies ?? null);
    if (cookies === "unrepresentable") {
      return {
        ...base,
        outcome: "unsupported",
        reason: "cannotRepresentCase",
        detail:
          "a cookie name repeated or a crumb carried no `=`, and req.cookies holds one " +
          "string per name, so the request cannot be handed over as it was sent",
      };
    }
    pendingCookies = cookies;
    let response;
    try {
      response = await sendRaw(target.port, request);
    } finally {
      pendingCookies = undefined;
    }
    const body = parseBody(response.body);

    if (response.status >= 200 && response.status < 300) {
      return {
        ...base,
        outcome: "accepted",
        deserialized: observeValues(testCase, body, "handedToHandler"),
        inputMutation: {
          kind: "notCompared",
          detail:
            "the library runs as middleware inside an express app this container drives " +
            "over a socket, so the request object it could write onto is one that server " +
            "built and this container never holds",
        },
        raw: toJsonValue({ status: response.status, body }),
      };
    }
    // A 4xx is the library's verdict only when it carries the library's error
    // list. Node's parser, the router's own parameter decoding and Express's
    // fallthrough 404 answer 4xx too, and none of those is this library
    // deciding anything.
    if (response.status >= 400 && response.status < 500 && !carriesLibraryErrors(body)) {
      return {
        ...base,
        outcome: "adapterError",
        detail: `the app answered ${response.status} without the library's error list`,
        raw: toJsonValue({ status: response.status, body }),
      };
    }
    if (response.status >= 400 && response.status < 500) {
      return {
        ...base,
        outcome: "rejected",
        deserialized: observeValues(testCase, body, "parsedBeforeValidation"),
        inputMutation: {
          kind: "notCompared",
          detail:
            "the library runs as middleware inside an express app this container drives " +
            "over a socket, so the request object it could write onto is one that server " +
            "built and this container never holds",
        },
        raw: toJsonValue({ status: response.status, body }),
      };
    }
    if (response.status >= 500) {
      return {
        ...base,
        outcome: "libraryError",
        detail: `the middleware raised; the app answered ${response.status}`,
        raw: toJsonValue({ status: response.status, body }),
      };
    }
    return {
      ...base,
      outcome: "adapterError",
      detail: `unreadable status ${response.status}`,
      raw: toJsonValue({ status: response.status, body }),
    };
  }
}

function parseBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function observeValues(
  testCase: AdapterCase,
  body: unknown,
  vantage: ValueVantage,
): Observation<DeserializedValues> {
  // The echo carries params, query, headers and cookies. A parameter declared anywhere
  // else has no slot in it, and leaving it out of `value` would say this library
  // reported nothing for it. Reported per parameter, so a case declaring one
  // echoed parameter and one unechoed one still publishes the value for the
  // first.
  const unreadable: Record<string, string> = {};
  for (const parameter of declaredParameters(testCase.document)) {
    if (ECHOED.has(parameter.in)) continue;
    unreadable[parameter.name] =
      `the echoed request carries params, query, headers and cookies, so a parameter declared in ` +
      `${parameter.in} has no slot to be read from`;
  }
  return observed(vantage, echoedValues(testCase, body), unreadable);
}

function echoedValues(testCase: AdapterCase, body: unknown): DeserializedValues {
  const values: DeserializedValues = {};
  if (typeof body !== "object" || body === null) return values;

  const echoed = toJsonValue(body) as {
    params?: Record<string, JsonValue>;
    query?: Record<string, JsonValue>;
    headers?: Record<string, JsonValue>;
    cookies?: Record<string, JsonValue>;
  };

  for (const parameter of declaredParameters(testCase.document)) {
    // Only the locations the echo carries. A location express never populated
    // has nothing to say about the parameter.
    if (!ECHOED.has(parameter.in)) continue;
    const source =
      parameter.in === "path"
        ? echoed.params
        : parameter.in === "query"
          ? echoed.query
          : parameter.in === "cookie"
            ? echoed.cookies
            : echoed.headers;
    const key = parameter.in === "header" ? parameter.name.toLowerCase() : parameter.name;
    const value = source?.[key];
    if (value !== undefined) values[parameter.name] = value;
  }
  return values;
}

const ECHOED: ReadonlySet<string> = new Set(["cookie", "header", "path", "query"]);

function cookiesOf(req: express.Request): unknown {
  return (req as express.Request & { cookies?: unknown }).cookies ?? null;
}

/**
 * The harness's cookie pairs as the record req.cookies holds, `undefined` when
 * the harness supplied none, or "unrepresentable" when a pair has no spelling
 * in a record of one string per name.
 */
function cookieRecord(
  cookies: ReadonlyArray<readonly [name: string, value: string | null]> | null,
): Record<string, string> | undefined | "unrepresentable" {
  if (cookies === null) return undefined;
  const record = new Map<string, string>();
  for (const [name, value] of cookies) {
    if (value === null || record.has(name)) return "unrepresentable";
    record.set(name, value);
  }
  return Object.fromEntries(record);
}

/** Whether the error handler echoed an error list the middleware raised. */
function carriesLibraryErrors(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { errors?: unknown }).errors)
  );
}

/** A path no case document declares, so a loaded document answers it 404. */
const PREFLIGHT_PATH = "/openapi-crosscheck-preflight/0/0/0";

/** The path values the middleware recorded on req.openapi, when it got that far. */
function openapiPathParams(req: express.Request): unknown {
  const recorded = (req as express.Request & { openapi?: { pathParams?: unknown } }).openapi;
  return recorded?.pathParams;
}
