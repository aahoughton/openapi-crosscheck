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
 * removes the percent-encoding cases the corpus exists to run. Making that
 * structural is simpler than relying on every container to remember it.
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
 * `cookies` is an ordered list of pairs for the same reason `query` and the
 * wire's `headers` are. A repeated name is a probe dimension the corpus varies,
 * and a JSON object holds one value per key, so a record here would drop a
 * crumb before the container saw it and publish the library's verdict on what
 * survived. Collapsing repeats is a choice about what a library's request shape
 * can carry, which belongs to the container that knows that shape.
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
  /**
   * Where the installed package says its source lives, or `null` when it says
   * nothing.
   *
   * Read from the package's own metadata at runtime, the same rule as
   * `libraryVersion`, so the harness never holds a URL for a library. A URL
   * written above the adapter layer would be code naming a library, and one
   * written into a container by hand would be a claim nothing resolves.
   *
   * `null` rather than absent. An omitted field defaults silently and a
   * container that cannot find a URL should say so, which is the same reason
   * every location in `splitting` must be answered.
   */
  readonly librarySource: string | null;
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
 * The one value channel no other field can show. A container hands its library
 * a request object; a library that writes deserialized values onto that object
 * has given its caller those values without any published call returning them,
 * and `deserialized: unexposed` beside it would be understating what a caller
 * can reach.
 *
 * Answered by the container because only the container holds both sides of the
 * comparison, and only its own language knows what comparing them means.
 * `detail` is required whichever kind is reported and carries the scope: what
 * was compared, what changed, or why nothing could be. A `none` is read
 * against its own scope, and a container that can compare nothing at all
 * reports `notCompared` rather than a `none` covering nothing.
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
      /** The runner-issued reasons never come from a container. */
      readonly reason: Exclude<UnsupportedReason, "stageNotOwned" | "oasVersionNotDeclared">;
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
