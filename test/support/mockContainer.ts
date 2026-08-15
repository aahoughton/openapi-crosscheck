import { createServer, type Server } from "node:http";
import { connect, type Transport } from "../../src/container/client";
import type { Adapter, AdapterCapabilities, AdapterProvenance } from "../../src/types/adapter";
import type { DescribeResponse, RunRequest, RunResponse } from "../../src/types/container";
import { PROTOCOL_VERSION } from "../../src/types/container";

/**
 * A protocol server running in this process.
 *
 * The protocol is HTTP, so the cheapest honest double for a container is a
 * server rather than a fake adapter object. Everything in `client.ts` then
 * stays on the path: the request encoding, the version check, and the four
 * failure branches that turn a broken container into an `adapterError` cell.
 * A fake adapter would skip all of it, and those branches are what a library
 * owner meets first when their container misbehaves.
 *
 * What it answers is entirely up to the caller, which is the other reason to
 * have it. Shapes that are awkward to provoke from a real library, an
 * `unexposed` observation, a contradicted splitting claim, a 500, a body that
 * is not JSON, are a line each here.
 */
export interface MockContainerOptions {
  /** Overrides for `/describe`. Anything unset gets a plausible default. */
  readonly describe?: Partial<DescribeResponse>;
  /** What `/run` answers. Defaults to accepting with no values exposed. */
  readonly run?: (request: RunRequest) => RunResponse;
  /** Answer `/run` with this status and body instead, to exercise the error paths. */
  readonly malfunction?: { readonly status: number; readonly body: string };
}

export interface MockContainer {
  readonly baseUrl: string;
  readonly transport: Transport;
  /** Every `/run` message the harness sent, in order. */
  readonly received: RunRequest[];
  close(): Promise<void>;
}

const DEFAULT_CAPABILITIES: AdapterCapabilities = {
  stages: {
    routing: true,
    splitting: { cookie: false, header: false, path: false, query: false },
    styleDeserialization: true,
    contentDeserialization: true,
    schemaValidation: true,
    valueExposure: false,
  },
  oasVersions: { "3.0": false, "3.1": true, "3.2": false },
};

/**
 * Start one, on a port the host picks.
 *
 * Port zero rather than a fixed number: vitest runs files in parallel workers,
 * and any fixed port is a collision waiting for the second test file.
 */
export async function startMockContainer(
  options: MockContainerOptions = {},
): Promise<MockContainer> {
  const received: RunRequest[] = [];

  const described: DescribeResponse = {
    protocol: PROTOCOL_VERSION,
    library: "mock-library",
    libraryVersion: "1.0.0",
    librarySource: "https://example.invalid/mock-library",
    libraryResolution: { kind: "registry", specifier: "latest" },
    capabilities: DEFAULT_CAPABILITIES,
    configuration: { id: "mock", description: "in-process protocol server", options: {} },
    ...options.describe,
  };

  const server = createServer((request, response) => {
    if (request.url === "/describe") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(described));
      return;
    }
    if (request.url !== "/run") {
      response.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const message = JSON.parse(Buffer.concat(chunks).toString("utf8")) as RunRequest;
      received.push(message);

      if (options.malfunction !== undefined) {
        response.writeHead(options.malfunction.status, { "content-type": "application/json" });
        response.end(options.malfunction.body);
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(options.run?.(message) ?? accepted()));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("mock bound no port");

  const close = (): Promise<void> => closeServer(server);
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    transport: { baseUrl: `http://127.0.0.1:${String(address.port)}`, dispose: close },
    received,
    close,
  };
}

/** A mock container, connected, as an adapter the runner cannot tell apart. */
export async function mockAdapter(options: MockContainerOptions = {}): Promise<Adapter> {
  const mock = await startMockContainer(options);
  return connect(mock.transport, inProcessProvenance(options.describe?.library ?? "mock-library"));
}

/**
 * Provenance for something that is not a container.
 *
 * Named rather than disguised. `pnpm measure` refuses to write a measurement
 * carrying this, which is what keeps a fixture from ever reaching a run
 * directory.
 */
export function inProcessProvenance(slug: string): AdapterProvenance {
  return { kind: "inProcess", slug, imageId: "none", ecosystem: "unknown" };
}

export function accepted(): RunResponse {
  return {
    protocol: PROTOCOL_VERSION,
    outcome: "accepted",
    deserialized: { kind: "unexposed", reason: "the mock exposes nothing by default" },
    inputMutation: { kind: "none", detail: "the mock hands the library nothing to change" },
    raw: null,
  };
}

export function rejected(): RunResponse {
  return {
    protocol: PROTOCOL_VERSION,
    outcome: "rejected",
    deserialized: { kind: "notReached", reason: "rejected before values were recovered" },
    inputMutation: { kind: "none", detail: "the mock hands the library nothing to change" },
    raw: null,
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}
