import type { JsonValue } from "./json";
import type { OasVersion, OpenApiDocument } from "./openapi";
import type { StageOwnership } from "./pipeline";
import type { AdapterResult } from "./result";
import type { PreparsedRequest } from "../wire/preparse";
import type { WireRequest } from "./wire";

/**
 * How the library under test got into the image.
 *
 * `libraryVersion` comes from the installed package, and an unreleased tree
 * carries the last released version there, so a run measuring a working tree
 * records the release it was branched from. This is what says so.
 */
export interface LibraryResolution {
  readonly kind: "registry" | "local";
  readonly specifier: string | null;
}

export interface AdapterCapabilities {
  /**
   * What the library does for itself, stage by stage.
   */
  readonly stages: StageOwnership;
  readonly queryPairInput: QueryPairInput;
  /**
   * Which OpenAPI versions the library is claimed to accept documents of.
   *
   * Explicit per version the protocol knows, the same rule as splitting: a
   * missing key would default silently, and "does not support 3.0" and
   * "nobody answered for 3.0" are different facts.
   */
  readonly oasVersions: Readonly<Record<OasVersion, boolean>>;
}

export type QueryPairInput = "raw" | "decoded" | "notUsed";

/**
 * The setup that produced a result. Configuration is a confound: a library
 * rejecting everything may be misconfigured rather than strict, so every result
 * carries the configuration that produced it and the report prints it.
 */
export interface Configuration {
  readonly id: string;
  readonly description: string;
  readonly options: JsonValue;
}

/**
 * Everything an adapter is given: the identifier and the document.
 *
 * Deliberately narrower than `Case`. An adapter has no business reading the
 * expected verdict, the expected values or the citations, and once adapters run
 * in containers that stops being a matter of discipline: what a container cannot
 * see, it cannot shape its answer to. The corpus stays on this side of the
 * boundary and only the question crosses it.
 */
export interface AdapterCase {
  readonly id: string;
  readonly document: OpenApiDocument;
}

/**
 * The library-specific half of this container. It says nothing about where the
 * image came from: the harness records that, because a claim the library made
 * about itself would be unchecked.
 */
export interface LibraryAdapter {
  /** npm package name. The sole ordering key, everywhere, in ASCII order. */
  readonly library: string;
  /** Resolved at runtime from the installed package, not written down by hand. */
  readonly libraryVersion: string;
  /**
   * The source location the installed package points at, or `null`.
   *
   * Resolved like the version, and it is the package's own claim rather than a
   * verified provenance chain.
   */
  readonly librarySource: string | null;
  /** Derived from this container's own manifest, never written down by hand. */
  readonly libraryResolution: LibraryResolution;
  readonly capabilities: AdapterCapabilities;
  readonly configuration: Configuration;
  /**
   * `preparsed` is the split the harness performed, per location. A location is
   * `null` when this adapter declared that its library recovers those values
   * itself, and an adapter must not read a location it declared it owns. It is
   * computed harness-side so every library that delegates a split is handed the
   * same one: a library splitting for itself would be measured against its own
   * splitting rather than against the others.
   */
  run(
    testCase: AdapterCase,
    request: WireRequest,
    preparsed: PreparsedRequest,
  ): Promise<AdapterResult>;
  /** Release anything held open, such as a bound port. */
  dispose?(): Promise<void>;
}
