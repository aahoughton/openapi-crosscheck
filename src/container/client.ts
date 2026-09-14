import type { Adapter, AdapterCase, AdapterProvenance } from "../types/adapter";
import type { AdapterResult, Observation, DeserializedValues } from "../types/result";
import type { DescribeResponse, RunRequest, RunResponse } from "../types/container";
import { PROTOCOL_VERSION } from "../types/container";
import type { PreparsedRequest } from "../wire/preparse";
import type { WireRequest } from "../types/wire";
import { toWireMessage } from "./wireMessage";

/**
 * Somewhere that speaks the protocol over HTTP, and how to let go of it.
 *
 * Deliberately not a container. This file has no business knowing what Docker
 * is: it speaks the protocol to a URL, and what is behind the URL is the
 * caller's affair. That is what lets the tests point it at a server in this
 * process and exercise every error branch below without an image.
 */
export interface Transport {
  readonly baseUrl: string;
  dispose(): Promise<void>;
}

/**
 * An adapter backed by a protocol server.
 *
 * Implements the same interface as an in-process adapter, so the runner, the
 * scorer and the report cannot tell the difference and none of them changed.
 * This file names no library: it is handed something that already answered
 * `/describe` and speaks the protocol to it.
 *
 * Provenance is passed in rather than derived here, because it is the caller
 * that built the image and knows its id. A container asserting its own would be
 * a claim with nothing checking it, which is the same reason preparse is
 * stamped harness-side.
 */
export async function connect(
  transport: Transport,
  provenance: AdapterProvenance,
): Promise<Adapter> {
  const described = await describe(transport, provenance.slug);

  return {
    library: described.library,
    libraryVersion: described.libraryVersion,
    librarySource: described.librarySource,
    libraryResolution: described.libraryResolution,
    capabilities: described.capabilities,
    configuration: described.configuration,
    provenance,

    async run(
      testCase: AdapterCase,
      request: WireRequest,
      preparsed: PreparsedRequest,
    ): Promise<AdapterResult> {
      const base = {
        library: described.library,
        libraryVersion: described.libraryVersion,
        configurationId: described.configuration.id,
        preparse: null,
      } as const;

      const message: RunRequest = {
        protocol: PROTOCOL_VERSION,
        caseId: testCase.id,
        document: testCase.document,
        request: toWireMessage(request),
        preparsed,
      };

      let answer: RunResponse;
      try {
        const response = await fetch(`${transport.baseUrl}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(message),
        });
        if (!response.ok) {
          return {
            ...base,
            outcome: "adapterError",
            detail: `container answered ${String(response.status)} to /run`,
            raw: null,
          };
        }
        answer = (await response.json()) as RunResponse;
      } catch (error) {
        // The container died or was unreachable. Ours, never the library's.
        return {
          ...base,
          outcome: "adapterError",
          detail: `container unreachable: ${error instanceof Error ? error.message : String(error)}`,
          raw: null,
        };
      }

      if (answer.protocol !== PROTOCOL_VERSION) {
        return {
          ...base,
          outcome: "adapterError",
          detail: `container answered protocol ${String(answer.protocol)}, harness speaks ${String(PROTOCOL_VERSION)}`,
          raw: null,
        };
      }

      if (answer.outcome === "unsupported") {
        return { ...base, outcome: "unsupported", reason: answer.reason, detail: answer.detail };
      }
      if (answer.outcome === "adapterError" || answer.outcome === "libraryError") {
        return { ...base, outcome: answer.outcome, detail: answer.detail, raw: answer.raw };
      }
      return {
        ...base,
        outcome: answer.outcome,
        deserialized: answer.deserialized as Observation<DeserializedValues>,
        // Absent rather than wrong is the reading a missing field gets. A
        // container that answers this version of the protocol sends one; one
        // that sends nothing has compared nothing, so record that gap.
        inputMutation: answer.inputMutation ?? {
          kind: "notCompared",
          detail: "the container reported nothing about the input it handed over",
        },
        raw: answer.raw,
      };
    },

    async dispose(): Promise<void> {
      await transport.dispose();
    },
  };
}

async function describe(transport: Transport, slug: string): Promise<DescribeResponse> {
  const response = await fetch(`${transport.baseUrl}/describe`);
  if (!response.ok) {
    throw new Error(`${slug}: /describe answered ${String(response.status)}`);
  }
  const described = (await response.json()) as DescribeResponse;
  if (described.protocol !== PROTOCOL_VERSION) {
    // Refused rather than guessed at. A harness and a container disagreeing
    // about what a field means produce cells that look perfectly fine.
    throw new Error(
      `${slug}: speaks protocol ${String(described.protocol)}, harness speaks ${String(PROTOCOL_VERSION)}`,
    );
  }
  refuseUndeclaredQueryPairInput(described, slug);
  return described;
}

/**
 * The one declaration the runner reads to decide whether a case is askable at
 * all, checked here rather than trusted.
 *
 * The protocol suite holds the containers in this repository to it, and a
 * container measured from outside never meets that suite. An absent field
 * arrives as `undefined`, which compares equal to no member of the set: the
 * withholding guard would ask every case and the fitness table would publish
 * the word `undefined` as a fact about the library. A contradiction is refused
 * for the same reason, because the two fields answer one question between them
 * and a container that answers it twice has not said which answer to believe.
 */
function refuseUndeclaredQueryPairInput(described: DescribeResponse, slug: string): void {
  const declared: unknown = described.capabilities.queryPairInput;
  if (declared !== "raw" && declared !== "decoded" && declared !== "notUsed") {
    throw new Error(
      `${slug}: /describe answered capabilities.queryPairInput ${JSON.stringify(declared)}, ` +
        `and the protocol allows "raw", "decoded" or "notUsed"`,
    );
  }
  const ownsSplit = described.capabilities.stages.splitting.query;
  if ((declared === "notUsed") !== ownsSplit) {
    throw new Error(
      `${slug}: /describe answered capabilities.queryPairInput "${declared}" beside ` +
        `stages.splitting.query ${String(ownsSplit)}. A library owning the query split ` +
        `receives the target rather than pairs, so "notUsed" is the declaration exactly ` +
        `when it owns the split.`,
    );
  }
}
