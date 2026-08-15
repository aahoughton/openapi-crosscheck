import type { Case } from "./case";
import type { OasVersion } from "./openapi";
import type { JsonValue } from "./json";
import type { SplittableLocation, StageOwnership } from "./pipeline";
import type { AdapterResult } from "./result";
import type { PreparsedRequest } from "../wire/preparse";
import type { WireRequest } from "./wire";

/**
 * What a library can be asked, as distinct from what it answers.
 *
 * Every field here is a claim, and every claim is falsifiable: each capability
 * an adapter declares is backed by a test in that adapter's own test file
 * demonstrating it. A declaration nobody can check is not a measurement.
 *
 * These are declared rather than discovered on purpose. A probe that discovers
 * whether a library exposes values is itself a measurement, carrying the same
 * misattribution risk as any other, and it would need either library-specific
 * probe code or code above the adapter layer that knows about libraries.
 */
/**
 * How the library under test got into the image.
 *
 * `libraryVersion` is read from the installed package, and an unreleased tree
 * carries the last released version in its manifest. So a run measuring a
 * working tree two commits ahead of 7.0.0 records 7.0.0, which is wrong in the
 * one situation where being wrong matters: grading a fix before it ships.
 *
 * Derived rather than declared, which is the opposite of the rule for
 * `librarySource` and for the same reason. A hand-written value survives being
 * copied: someone forks a container, points it at a tarball, and the `registry`
 * they inherited is still sitting there claiming the run came from a release.
 * The specifier is read from the container's own manifest, which is the file
 * that person edited.
 */
export interface LibraryResolution {
  /**
   * `registry` for a public resolution, `local` for a path, an archive or a
   * link. The spellings differ per ecosystem, so each container decides which
   * of its own it is looking at.
   */
  readonly kind: "registry" | "local";
  /** What the manifest asked for, verbatim, or `null` where there is no such string. */
  readonly specifier: string | null;
}

export interface AdapterCapabilities {
  /**
   * What the library does for itself, stage by stage.
   *
   * Stage by stage rather than a few booleans sampling the pipeline, because
   * ownership is not all-or-nothing: a library can take some locations and not
   * others, and a coarser record would stamp provenance covering locations the
   * library never asked the harness to touch.
   */
  readonly stages: StageOwnership;
  /**
   * Which OpenAPI versions the library is claimed to accept documents of.
   *
   * Explicit per version the protocol knows, for the same reason splitting is
   * explicit per location: a missing key would default silently, and the
   * difference between "does not support 3.0" and "nobody answered for 3.0"
   * is exactly the difference this field exists to record. The runner asks a
   * library only the cases whose version it declares; the rest are published
   * as `oasVersionNotDeclared` rather than scored.
   */
  readonly oasVersions: Readonly<Record<OasVersion, boolean>>;
}

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
 * Where the library that answered came from.
 *
 * The resolved version says what was measured. This says everything else about
 * the environment it was measured in, which is what `latest` costs: two runs a
 * month apart can report the same version and differ in a transitive
 * dependency. The image is content-addressed, so recording its id identifies
 * the built image that answered.
 */
export interface AdapterProvenance {
  /**
   * `inProcess` is a protocol server running in this process, which the tests
   * use to exercise the harness without Docker. It is named rather than
   * disguised as a container, and `pnpm measure` refuses to write a measurement
   * carrying it: a run directory holds what containers answered, and a fixture
   * written there would look like a container measurement.
   */
  readonly kind: "container" | "inProcess";
  /** The adapter directory that built it, by base name. */
  readonly slug: string;
  /** Content-addressed image id, as `docker image inspect` reports it. */
  readonly imageId: string;
  /**
   * The public registry the library was installed from.
   *
   * Read from which manifest the adapter directory holds rather than declared
   * by the container, for the same reason the image id is: a container claiming
   * its own ecosystem would be a claim with nothing behind it, while the
   * manifest that installed the library is evidence the harness can see. It is
   * also what makes a version string legible, since `0.146.0` from Go modules
   * and `0.146.0` from npm are not the same kind of thing.
   */
  readonly ecosystem: Ecosystem;
}

/**
 * The public package sources adapters install from.
 *
 * A closed set, so a new adapter has to say which of these it is or add one
 * deliberately. `unknown` exists for an adapter directory whose manifest this
 * does not recognise, and reporting it is better than guessing.
 */
export type Ecosystem = "go" | "maven" | "npm" | "packagist" | "pypi" | "rubygems" | "unknown";

/**
 * Everything an adapter is given: the identifier and the document.
 *
 * Deliberately narrower than `Case`. An adapter has no business reading the
 * expected verdict, the expected values or the citations, and once adapters run
 * in containers that stops being a matter of discipline: what a container cannot
 * see, it cannot shape its answer to. The corpus stays on this side of the
 * boundary and only the question crosses it.
 */
export type AdapterCase = Pick<Case, "id" | "document">;

/**
 * Which locations the harness must split for this library, being the ones it
 * does not split itself. Derived, so it cannot disagree with the declaration.
 */
export function delegatedSplits(
  capabilities: AdapterCapabilities,
): Readonly<Record<SplittableLocation, boolean>> {
  const { splitting } = capabilities.stages;
  return {
    cookie: !splitting.cookie,
    header: !splitting.header,
    path: !splitting.path,
    query: !splitting.query,
  };
}

/**
 * The only library-specific code in the project. Nothing above this layer names
 * a library or branches on which one is running.
 *
 * This is the half a container serves. It says nothing about where it came
 * from, because a library has no way to know that and anything it claimed about
 * it would be unchecked.
 */
export interface LibraryAdapter {
  /** Package name. The sole ordering key, everywhere, alphabetically. */
  readonly library: string;
  /** Resolved at runtime from the installed package, not written down by hand. */
  readonly libraryVersion: string;
  /**
   * The source location the installed package points at, or `null`.
   *
   * Resolved the same way as the version, and it is the package's own claim
   * rather than a verified provenance chain: a package can point anywhere. The
   * reports say so where they show it.
   */
  readonly librarySource: string | null;
  /**
   * How that version was resolved, derived from the container's own manifest.
   * A local resolution means `libraryVersion` is the release the measured tree
   * was branched from rather than the code that answered.
   */
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

/**
 * What the harness runs: a library adapter, plus where the harness got it.
 *
 * The provenance is filled in on this side because the harness built the image
 * and knows its id. A container asserting its own would be a claim with nothing
 * checking it, which is the same reason preparse is stamped here.
 */
export interface Adapter extends LibraryAdapter {
  readonly provenance: AdapterProvenance;
}
