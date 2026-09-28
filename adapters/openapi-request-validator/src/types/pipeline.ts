/** The pipeline-stage claims a container declares at `/describe`. */

/**
 * Which locations splitting is a question for.
 *
 * Written out rather than aliased to `ParameterLocation`. Splitting is claimed
 * per location and `querystring` is not one of the locations it is a question
 * for, so the two sets are not the same set: aliasing them would turn the fifth
 * parameter location into a fifth `splitting` key the protocol does not have.
 */
export type SplittableLocation = "cookie" | "header" | "path" | "query";

/**
 * What a library does for itself, stage by stage.
 *
 * `splitting` is per location: a library can extract path parameters from a raw
 * target and still leave the query string to its caller.
 *
 * Every field is a claim the harness probes two-sidedly and publishes.
 */
export interface StageOwnership {
  readonly routing: boolean;
  readonly splitting: Readonly<Record<SplittableLocation, boolean>>;
  readonly styleDeserialization: boolean;
  /**
   * Whether the library reads a `content` parameter's value as a representation
   * of its declared media type.
   *
   * Separate from `styleDeserialization` because the two are sibling mechanisms
   * rather than one stage, and because a single boolean covering both cannot be
   * true of a library that does one and not the other. A library declaring
   * `false` here is still asked every `schema` case; it is asked no `content`
   * case, and `capabilities.md` publishes what the evidence probe saw when it
   * ran the stage against it anyway.
   */
  readonly contentDeserialization: boolean;
  readonly schemaValidation: boolean;
  readonly valueExposure: boolean;
}
