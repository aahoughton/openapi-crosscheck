import http from "node:http";
import type { LibraryAdapter } from "../types/adapter";
import type { AdapterResult } from "../types/result";
import type {
  DescribeResponse,
  ObservationMessage,
  RunRequest,
  RunResponse,
} from "../types/container";
import { PROTOCOL_VERSION } from "../types/container";
import { fromWireMessage } from "./wireMessage";

/**
 * Serve one adapter over the container protocol.
 *
 * Shared by every JavaScript container, so the protocol is implemented once
 * rather than once per library. A container in another language implements the
 * same two endpoints against `docs/container-protocol.md`.
 *
 * This file knows nothing about which library it is serving. It is handed an
 * adapter and speaks the protocol for it.
 */
export function serve(adapter: LibraryAdapter, port: number): Promise<http.Server> {
  const server = http.createServer((request, response) => {
    void handle(adapter, request, response);
  });
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function handle(
  adapter: LibraryAdapter,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  try {
    if (request.method === "GET" && request.url === "/describe") {
      return send(response, 200, describe(adapter));
    }
    if (request.method === "POST" && request.url === "/run") {
      const body = JSON.parse(await readBody(request)) as RunRequest;
      if (body.protocol !== PROTOCOL_VERSION) {
        // Refused rather than guessed at. A container and a harness disagreeing
        // about what a field means would produce cells that look fine.
        return send(response, 400, {
          error: `protocol ${String(body.protocol)}, this container speaks ${String(PROTOCOL_VERSION)}`,
        });
      }
      return send(response, 200, await run(adapter, body));
    }
    send(response, 404, { error: "no such endpoint" });
  } catch (error) {
    // The container's own failure. It crosses as `adapterError` so it can never
    // be read as the library rejecting anything.
    send(response, 200, {
      protocol: PROTOCOL_VERSION,
      outcome: "adapterError",
      detail: error instanceof Error ? error.message : String(error),
      raw: null,
    } satisfies RunResponse);
  }
}

function describe(adapter: LibraryAdapter): DescribeResponse {
  return {
    protocol: PROTOCOL_VERSION,
    library: adapter.library,
    libraryVersion: adapter.libraryVersion,
    librarySource: adapter.librarySource,
    libraryResolution: adapter.libraryResolution,
    capabilities: adapter.capabilities,
    configuration: adapter.configuration,
  };
}

async function run(adapter: LibraryAdapter, message: RunRequest): Promise<RunResponse> {
  const result = await adapter.run(
    { id: message.caseId, document: message.document },
    fromWireMessage(message.request),
    message.preparsed,
  );
  return toRunResponse(result);
}

/**
 * Drop the fields the harness owns and keep the ones the library produced.
 *
 * `library`, `libraryVersion` and `configurationId` come from `/describe`, and
 * `preparse` records what the harness did before asking. A container restating
 * them would create two sources for one fact.
 */
function toRunResponse(result: AdapterResult): RunResponse {
  if (result.outcome === "unsupported") {
    if (result.reason === "stageNotOwned") {
      return {
        protocol: PROTOCOL_VERSION,
        outcome: "adapterError",
        detail: "a container issued stageNotOwned, which only the harness may issue",
        raw: null,
      };
    }
    return {
      protocol: PROTOCOL_VERSION,
      outcome: "unsupported",
      reason: result.reason,
      detail: result.detail,
    };
  }
  if (result.outcome === "adapterError" || result.outcome === "libraryError") {
    return {
      protocol: PROTOCOL_VERSION,
      outcome: result.outcome,
      detail: result.detail,
      raw: result.raw,
    };
  }
  return {
    protocol: PROTOCOL_VERSION,
    outcome: result.outcome,
    deserialized: result.deserialized as ObservationMessage,
    inputMutation: result.inputMutation,
    raw: result.raw,
  };
}

function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => (data += chunk));
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

function send(response: http.ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(encoded),
  });
  response.end(encoded);
}
