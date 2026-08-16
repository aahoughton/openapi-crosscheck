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
  oasVersions: { "3.0": true, "3.1": true, "3.2": false },
};

const configuration: Configuration = {
  id: "middleware-validate-requests",
  description:
    "OpenApiValidator.middleware({ apiSpec, validateRequests: true }) mounted on an " +
    "express app, exactly as the published usage shows, with a handler that echoes " +
    "the request it received and an error handler that reports the thrown status " +
    "alongside the same request fields. " +
    "Reading its values: on an accepted request they are what the handler was " +
    "handed. On a rejected one they are what the middleware had coerced onto the " +
    "request before it stopped, so they are partial and stop at the first failure.",
  options: { validateRequests: true },
};

interface Mounted {
  readonly server: Server;
  readonly port: number;
}

export function createAdapter(): LibraryAdapter {
  const mounted = new Map<string, Promise<Mounted>>();

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
    app.use(
      OpenApiValidator.middleware({
        apiSpec: testCase.document as never,
        validateRequests: true,
      }),
    );
    for (const template of templatesOf(testCase.document)) {
      app.all(toColonTemplate(template), (req, res) => {
        res.status(200).json({ params: req.params, query: req.query, headers: req.headers });
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
          params: req.params,
          query: req.query,
          headers: req.headers,
        });
      },
    );

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("no port bound");
    return { server, port: address.port };
  }

  return {
    library: LIBRARY,
    libraryVersion: readVersion(LIBRARY),
    librarySource: SOURCE,
    libraryResolution: readResolution(LIBRARY),
    capabilities,
    configuration,

    async run(testCase: AdapterCase, request: WireRequest): Promise<AdapterResult> {
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

      const response = await sendRaw(target.port, request);
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
    },

    async dispose(): Promise<void> {
      for (const pending of mounted.values()) {
        const { server } = await pending;
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      mounted.clear();
    },
  };
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
  if (declaredParameters(testCase.document).some((parameter) => parameter.in === "cookie")) {
    return {
      kind: "unexposed",
      reason:
        "cookie values are not exposed in this configuration; mounting a cookie parser " +
        "would make the harness perform the split under test",
    };
  }
  // The echo carries params, query and headers. A parameter declared anywhere
  // else has no slot in it, and reporting the rest would publish an empty value
  // cell as this library's answer for a parameter nothing read. `querystring`
  // is the location that reaches this today.
  const unechoed = declaredParameters(testCase.document).filter(
    (parameter) => parameter.in !== "path" && parameter.in !== "query" && parameter.in !== "header",
  );
  if (unechoed.length > 0) {
    const locations = [...new Set(unechoed.map((parameter) => parameter.in))].sort().join(", ");
    return {
      kind: "unexposed",
      reason:
        `the echoed request carries params, query and headers, so a parameter declared in ` +
        `${locations} has no slot to be read from`,
    };
  }
  return observed(vantage, echoedValues(testCase, body));
}

function echoedValues(testCase: AdapterCase, body: unknown): DeserializedValues {
  const values: DeserializedValues = {};
  if (typeof body !== "object" || body === null) return values;

  const echoed = toJsonValue(body) as {
    params?: Record<string, JsonValue>;
    query?: Record<string, JsonValue>;
    headers?: Record<string, JsonValue>;
  };

  for (const parameter of declaredParameters(testCase.document)) {
    // Only the three locations the echo carries. The chain used to end at
    // `headers`, so a location with no bag of its own was looked up there by
    // name: a `querystring` parameter, which a 3.2 document can declare, would
    // have read whatever header shared its name and had it published as that
    // parameter's value. An echo has nothing to say about a location express
    // never populated, and saying nothing is the answer.
    if (parameter.in !== "path" && parameter.in !== "query" && parameter.in !== "header") {
      continue;
    }
    const source =
      parameter.in === "path"
        ? echoed.params
        : parameter.in === "query"
          ? echoed.query
          : echoed.headers;
    const key = parameter.in === "header" ? parameter.name.toLowerCase() : parameter.name;
    const value = source?.[key];
    if (value !== undefined) values[parameter.name] = value;
  }
  return values;
}
