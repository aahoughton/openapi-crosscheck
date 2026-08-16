import type { AdapterCapabilities, Configuration, LibraryResolution } from "./adapter";
import type { JsonValue } from "./json";
import type { DeserializedValues, UnsupportedReason, ValueVantage } from "./result";
import type { OpenApiDocument } from "./openapi";

/**
 * The container protocol. `docs/container-protocol.md` is the
 * contract and explains why the shape is what it is; this file is that document
 * in types, and the two are meant to be read together.
 *
 * Nothing here names a library. A container answering these messages produces
 * rows that mean the same thing as any other container's, whatever language it
 * is written in.
 */
export const PROTOCOL_VERSION = 3;

/**
 * A request as it crosses the boundary.
 *
 * `targetBase64` rather than a plain string because the target is the one field
 * a transport would parse given the chance, and a transport that re-encodes it
 * deletes exactly the percent-encoding cases the corpus exists to run. Making
 * that structural is cheaper than relying on everyone remembering.
 *
 * `headers` stays an ordered list of pairs. Duplicate names and non-canonical
 * casing are probe dimensions and a JSON object collapses both. They travel as
 * plain strings because every header in the corpus is UTF-8 and JSON carries
 * UTF-8 without loss.
 */
export interface WireMessage {
  readonly method: string;
  readonly targetBase64: string;
  readonly headers: ReadonlyArray<readonly [name: string, value: string]>;
}

/**
 * The split the harness performed, per location.
 *
 * `null` for a location means the harness supplied nothing there, because the
 * container declared that its library recovers those values itself. A container
 * must not read a location it declared it owns: doing so would measure the
 * harness's splitting while the declaration says otherwise, and nothing in the
 * protocol could detect it.
 *
 * A query pair's value is `null` where the pair carried no `=`. `?p` and `?p=`
 * are different requests, and a container decides for itself whether its
 * library's input shape can tell them apart.
 *
 * `cookies` is an ordered list of pairs, like `query`. A repeated cookie name
 * is a probe dimension and a JSON object holds one value per key, so a record
 * would drop a crumb before this container saw it. Collapsing repeats is the
 * container's call, because only it knows what its library's request shape can
 * carry.
 */
export interface PreparsedMessage {
  readonly params: Record<string, string> | null;
  readonly query: ReadonlyArray<readonly [name: string, value: string | null]> | null;
  readonly headers: Record<string, string | string[]> | null;
  readonly cookies: ReadonlyArray<readonly [name: string, value: string | null]> | null;
}

export interface DescribeResponse {
  readonly protocol: number;
  readonly library: string;
  readonly libraryVersion: string;
  /** Where the installed package says its source is, or `null` when it says nothing. */
  readonly librarySource: string | null;
  /** How the library was resolved into the image, derived from the manifest. */
  readonly libraryResolution: LibraryResolution;
  readonly capabilities: AdapterCapabilities;
  readonly configuration: Configuration;
}

export interface RunRequest {
  readonly protocol: number;
  readonly caseId: string;
  readonly document: OpenApiDocument;
  readonly request: WireMessage;
  readonly preparsed: PreparsedMessage;
}

/**
 * The value channel as it crosses the boundary.
 *
 * `nativeTypes` carries the language-level type of each value, keyed by the
 * same declared parameter names as `value`. It exists because JSON has one
 * number type and languages do not, and it is reported but never scored: a
 * library is never failed for its language's number model. See the protocol
 * document for why that split is the one that keeps the roster fair.
 */
export type ObservationMessage =
  | {
      readonly kind: "observed";
      readonly vantage: ValueVantage;
      readonly value: DeserializedValues;
      readonly nativeTypes: Record<string, string>;
    }
  | { readonly kind: "unexposed"; readonly reason: string }
  | { readonly kind: "notReached"; readonly reason: string };

/**
 * Whether the input the container handed the library came back changed.
 *
 * The one value channel no other field can show. A library that writes
 * deserialized values onto the request object its caller gave it has handed
 * that caller the values without any published call returning them, and an
 * `unexposed` beside it would understate what a caller can reach.
 *
 * `detail` is required whichever kind is reported and carries the scope: what
 * was compared, what changed, or why nothing could be.
 */
export interface InputMutationMessage {
  readonly kind: "none" | "observed" | "notCompared";
  readonly detail: string;
}

export type RunResponse =
  | {
      readonly protocol: number;
      readonly outcome: "accepted" | "rejected";
      readonly deserialized: ObservationMessage;
      readonly inputMutation: InputMutationMessage;
      readonly raw: JsonValue;
    }
  | {
      readonly protocol: number;
      readonly outcome: "unsupported";
      /** `stageNotOwned` is issued by the harness, never by a container. */
      readonly reason: Exclude<UnsupportedReason, "stageNotOwned">;
      readonly detail: string;
    }
  | {
      /** The library raised instead of answering. Attributable to it. */
      readonly protocol: number;
      readonly outcome: "libraryError";
      readonly detail: string;
      readonly raw: JsonValue;
    }
  | {
      readonly protocol: number;
      readonly outcome: "adapterError";
      readonly detail: string;
      readonly raw: JsonValue;
    };
