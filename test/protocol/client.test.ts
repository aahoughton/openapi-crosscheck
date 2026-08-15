import { afterAll, describe, expect, it } from "vitest";
import { connect } from "../../src/container/client";
import { PROTOCOL_VERSION } from "../../src/types/container";
import type { AdapterCase } from "../../src/types/adapter";
import { delegatedSplits } from "../../src/types/adapter";
import type { WireRequest } from "../../src/types/wire";
import { preparse } from "../../src/wire/preparse";
import { fromWireMessage } from "../../src/container/wireMessage";
import {
  accepted,
  inProcessProvenance,
  mockAdapter,
  startMockContainer,
} from "../support/mockContainer";
import { protocolSuite } from "../support/protocolSuite";

/**
 * The protocol client, against a server in this process.
 *
 * A container that misbehaves is what a library owner meets first, and every
 * one of those meetings is a branch in `client.ts` that turns the misbehaviour
 * into an `adapterError` cell saying what happened. Reaching them with real
 * containers would mean breaking one on purpose; here each is a few lines, and
 * they run on every `pnpm test`.
 */

const document: AdapterCase = {
  id: "client-probe",
  document: {
    openapi: "3.1.0",
    info: { title: "client", version: "1" },
    paths: {
      "/t/{p}": {
        get: {
          operationId: "client",
          parameters: [
            {
              name: "p",
              in: "path",
              required: true,
              style: "simple" as const,
              explode: false,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  },
};

const request: WireRequest = {
  method: "GET",
  target: "/t/blue",
  headers: [["Host", "harness.invalid"]],
};

const adapter = await mockAdapter();
afterAll(async () => {
  await adapter.dispose?.();
});

protocolSuite("the in-process mock", [adapter]);

describe("a container that misbehaves is attributed to the harness, never the library", () => {
  it("reports the status when /run answers with an error", async () => {
    const mock = await startMockContainer({
      malfunction: { status: 500, body: '{"broken":true}' },
    });
    const broken = await connect(mock.transport, inProcessProvenance("broken"));
    try {
      const result = await broken.run(
        document,
        request,
        preparse(document.document, request, delegatedSplits(broken.capabilities)),
      );
      expect(result.outcome).toBe("adapterError");
      if (result.outcome === "adapterError") expect(result.detail).toContain("500");
    } finally {
      await mock.close();
    }
  });

  it("reports the container unreachable when it dies mid-run", async () => {
    const mock = await startMockContainer();
    const dying = await connect(mock.transport, inProcessProvenance("dying"));
    await mock.close();

    const result = await dying.run(
      document,
      request,
      preparse(document.document, request, delegatedSplits(dying.capabilities)),
    );
    expect(result.outcome).toBe("adapterError");
    if (result.outcome === "adapterError") expect(result.detail).toContain("unreachable");
  });

  it("reports a body that is not the JSON the response claimed", async () => {
    const mock = await startMockContainer({
      malfunction: { status: 200, body: "this is not json" },
    });
    const garbling = await connect(mock.transport, inProcessProvenance("garbling"));
    try {
      const result = await garbling.run(
        document,
        request,
        preparse(document.document, request, delegatedSplits(garbling.capabilities)),
      );
      expect(result.outcome).toBe("adapterError");
    } finally {
      await mock.close();
    }
  });

  it("refuses an answer from a /run speaking another protocol version", async () => {
    // Caught per answer as well as at connect, because a container could serve
    // one version from /describe and another from /run, and the fields whose
    // meaning changed would be read as though they had not.
    const mock = await startMockContainer({
      run: () => ({ ...accepted(), protocol: PROTOCOL_VERSION + 1 }),
    });
    const drifting = await connect(mock.transport, inProcessProvenance("drifting"));
    try {
      const result = await drifting.run(
        document,
        request,
        preparse(document.document, request, delegatedSplits(drifting.capabilities)),
      );
      expect(result.outcome).toBe("adapterError");
      if (result.outcome === "adapterError") expect(result.detail).toContain("protocol");
    } finally {
      await mock.close();
    }
  });
});

describe("a container speaking another protocol version is refused at connect", () => {
  it("does not connect, rather than guessing at compatibility", async () => {
    // The version is the only thing standing between a field changing meaning
    // and a matrix that still looks perfectly plausible. Connecting to a
    // container answering a different number would produce cells nothing else
    // in the project could detect as wrong.
    const mock = await startMockContainer({ describe: { protocol: PROTOCOL_VERSION + 1 } });
    try {
      await expect(connect(mock.transport, inProcessProvenance("pretend"))).rejects.toThrow(
        /protocol/,
      );
    } finally {
      await mock.close();
    }
  });
});

describe("what crosses the boundary is what the harness meant to send", () => {
  it("hands the container the target byte for byte, and the split it performed", async () => {
    const mock = await startMockContainer();
    const connected = await connect(mock.transport, inProcessProvenance("echo"));
    const hostile: WireRequest = {
      method: "GET",
      target: "/t/blue%2Cblack",
      headers: [["Host", "harness.invalid"]],
    };
    try {
      await connected.run(
        document,
        hostile,
        preparse(document.document, hostile, delegatedSplits(connected.capabilities)),
      );
      const sent = mock.received[0];
      expect(sent).toBeDefined();
      if (sent === undefined) return;
      expect(fromWireMessage(sent.request).target).toBe(hostile.target);
      // The mock declares it splits nothing, so the harness must supply the
      // path parameter it recovered rather than leave the location null. It
      // arrives with its percent-encoding intact: splitting a path into
      // segments is upstream work the harness may do, and decoding one is the
      // library's, so a harness that handed over `blue,black` here would have
      // performed the deserialization it was measuring.
      expect(sent.preparsed.params).toEqual({ p: "blue%2Cblack" });
    } finally {
      await mock.close();
    }
  });
});
