import type { Adapter, AdapterCase, AdapterProvenance } from "../types/adapter";
import type { AdapterResult, Observation, DeserializedValues } from "../types/result";
import type { DescribeResponse, RunRequest, RunResponse } from "../types/container";
import { PROTOCOL_VERSION } from "../types/container";
import type { PreparsedRequest } from "../wire/preparse";
import type { WireRequest } from "../types/wire";
import { toWireMessage } from "./wireMessage";
import type { JsonValue } from "../types/json";

/**
 * How long one protocol call may take before the container is treated as
 * unreachable. Generous: a library answering one case takes milliseconds, and
 * a hung container would otherwise stall every case after it.
 */
const RUN_TIMEOUT_MS = 60_000;

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
          signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
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

      const problem = malformed(answer);
      if (problem !== null) {
        return {
          ...base,
          outcome: "adapterError",
          detail: `container answered a malformed /run: ${problem}`,
          raw: answer as unknown as JsonValue,
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
        inputMutation: answer.inputMutation,
        raw: answer.raw,
      };
    },

    async dispose(): Promise<void> {
      await transport.dispose();
    },
  };
}

async function describe(transport: Transport, slug: string): Promise<DescribeResponse> {
  const response = await fetch(`${transport.baseUrl}/describe`, {
    signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
  });
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

const OUTCOMES: ReadonlySet<string> = new Set([
  "accepted",
  "rejected",
  "unsupported",
  "libraryError",
  "adapterError",
]);
/** The unsupported reasons a container may give; the runner issues the rest. */
const CONTAINER_REASONS: ReadonlySet<string> = new Set([
  "adapterLimitation",
  "cannotRepresentCase",
  "libraryInitUnsupported",
]);
const VANTAGES: ReadonlySet<string> = new Set([
  "handedToHandler",
  "parsedBeforeValidation",
  "validatedOnly",
]);
const MUTATION_KINDS: ReadonlySet<string> = new Set(["none", "observed", "notCompared"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * What is wrong with a `/run` answer, or `null` when it has the shape the
 * protocol document gives it.
 *
 * Checked here rather than trusted because a container measured from outside
 * this repository never meets the protocol suite, and every field below is
 * read as a fact about the library. An unknown outcome would be published as a
 * verdict nobody defined, and a runner-issued reason from a container would
 * read as the harness having withheld the case.
 */
function malformed(answer: unknown): string | null {
  if (!isRecord(answer)) return "the body is not a JSON object";
  const { outcome } = answer;
  if (typeof outcome !== "string" || !OUTCOMES.has(outcome)) {
    return `outcome ${JSON.stringify(outcome)} is not one the protocol defines`;
  }
  if (outcome === "unsupported") {
    if (typeof answer["reason"] !== "string" || !CONTAINER_REASONS.has(answer["reason"])) {
      return `unsupported reason ${JSON.stringify(answer["reason"])} is not one a container may give`;
    }
    return typeof answer["detail"] === "string" ? null : "unsupported carries no detail";
  }
  if (outcome === "libraryError" || outcome === "adapterError") {
    if (typeof answer["detail"] !== "string") return `${outcome} carries no detail`;
    return "raw" in answer ? null : `${outcome} carries no raw`;
  }
  if (!("raw" in answer)) return `${outcome} carries no raw`;
  const mutation = answer["inputMutation"];
  if (
    !isRecord(mutation) ||
    typeof mutation["kind"] !== "string" ||
    !MUTATION_KINDS.has(mutation["kind"]) ||
    typeof mutation["detail"] !== "string"
  ) {
    return "inputMutation is missing or not a kind with a detail";
  }
  const observation = answer["deserialized"];
  if (!isRecord(observation)) return "deserialized is missing";
  if (observation["kind"] === "unexposed" || observation["kind"] === "notReached") {
    return typeof observation["reason"] === "string"
      ? null
      : `deserialized ${observation["kind"]} carries no reason`;
  }
  if (observation["kind"] !== "observed") {
    return `deserialized kind ${JSON.stringify(observation["kind"])} is not one the protocol defines`;
  }
  if (typeof observation["vantage"] !== "string" || !VANTAGES.has(observation["vantage"])) {
    return `vantage ${JSON.stringify(observation["vantage"])} is not one the protocol defines`;
  }
  const { value } = observation;
  if (!isRecord(value)) return "observed value is not an object";
  if (!isStringRecord(observation["nativeTypes"])) return "nativeTypes is not a map of strings";
  const unreadable = observation["unreadable"];
  if (unreadable !== undefined) {
    if (!isStringRecord(unreadable)) return "unreadable is not a map of reasons";
    const both = Object.keys(unreadable).filter((name) => Object.hasOwn(value, name));
    if (both.length > 0) return `${both.join(", ")} both read and unreadable`;
  }
  return null;
}
