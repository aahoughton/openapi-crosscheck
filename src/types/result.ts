import type { JsonValue } from "./json";

/**
 * Three-valued, because "this library never exposes deserialized values" and
 * "this library exposed no values here" are different facts about the world.
 * A report that renders both as a blank cell loses that distinction, so the
 * renderer has to handle three constructors.
 */
/**
 * From what point in a library's own processing the values were read.
 *
 * Closed set, and load-bearing: without it an absent parameter name means three
 * different things across the roster, and one column renders all three the
 * same. It sits on the observation rather than on the capabilities because a
 * library can report from different vantages on different verdicts, which is
 * exactly what a middleware does when its handler runs on one path and its
 * error handler on the other.
 */
export type ValueVantage =
  /** What the application's handler was given. A name is absent when it never ran. */
  | "handedToHandler"
  /** What the library parsed, reported whether or not it then rejected. */
  | "parsedBeforeValidation"
  /** What the library validated and accepted. A name is absent when it failed its schema. */
  | "validatedOnly";

/**
 * The language-level type of each reported value, as the library's own container
 * names it, keyed by declared parameter name.
 *
 * JSON has one number type and languages do not. A Python library returns an
 * int for `type: integer` and a float for `type: number`; a JavaScript library
 * returns the same value for both, because JavaScript has one number type. Both facts are true, they are different, and plain JSON renders them
 * identically.
 *
 * Reported and never scored. Scoring compares values by JSON equivalence, so a
 * library is never failed for the number model of the language it is written
 * in. These strings are the container's own naming, passed through unchanged,
 * and are displayed rather than compared.
 */
export type NativeTypes = Record<string, string>;

export type Observation<T> =
  | {
      readonly kind: "observed";
      readonly vantage: ValueVantage;
      readonly value: T;
      readonly nativeTypes: NativeTypes;
    }
  /** The library has no API that exposes this, at any input. */
  | { readonly kind: "unexposed"; readonly reason: string }
  /** The library could have exposed it and did not reach that point. */
  | { readonly kind: "notReached"; readonly reason: string };

/**
 * Closed set. An open-ended reason string turns `unsupported` into a junk
 * drawer, and a junk drawer is where misattributed results hide.
 */
export type UnsupportedReason =
  /**
   * Runner-issued: the case probes a pipeline stage this library leaves to its
   * caller, so its answer would describe the harness rather than the library.
   */
  | "stageNotOwned"
  /**
   * Runner-issued: the case's document is of an OpenAPI version this container
   * does not declare its library accepts, so no request was made.
   */
  | "oasVersionNotDeclared"
  /** The library has no way to express what the case declares. */
  | "cannotRepresentCase"
  /** The library refused the document itself, before any request was made. */
  | "libraryInitUnsupported"
  /** This adapter cannot drive the library through its published API. Attributable to us. */
  | "adapterLimitation";

/** Values handed to the application, keyed by parameter name. */
export type DeserializedValues = Record<string, JsonValue>;

/**
 * What the harness did to the wire request before a preparsed-input library saw
 * it. Recorded on every such result: for those cells the split was performed
 * here, and a reader has to be able to see that without taking anyone's word.
 */
export interface Preparse {
  readonly performedBy: "harness";
  readonly description: string;
  readonly result: JsonValue;
}

interface ResultBase {
  readonly library: string;
  readonly libraryVersion: string;
  readonly configurationId: string;
  readonly preparse: Preparse | null;
}

/**
 * Whether the library wrote back onto the input it was handed.
 *
 * A value channel the protocol could not otherwise see. A validator built on a
 * coercing schema engine can hand deserialized values back in band, by writing
 * them onto the request object its caller gave it, and a caller reading that
 * object afterwards is reading a real value channel. A library doing that while
 * declaring no value exposure has an exposure it did not declare, and every
 * value cell for it understates what a caller can get.
 *
 * Observed by the container, because only the container holds the object it
 * handed over and only its language can compare one. `detail` is required on
 * every kind and carries the scope: what was compared, what changed, or why
 * nothing could be. A `none` is read against its own scope, so a container
 * that can only compare the parts carrying the case's values says so there,
 * and one that can compare nothing reports `notCompared` instead.
 */
export type InputMutation = {
  readonly kind: "none" | "observed" | "notCompared";
  readonly detail: string;
};

interface Decided extends ResultBase {
  readonly deserialized: Observation<DeserializedValues>;
  readonly inputMutation: InputMutation;
  /**
   * The library's own output or thrown error, serialized and otherwise
   * unedited. Every rendered cell traces back to this.
   */
  readonly raw: JsonValue;
}

export type AdapterResult =
  | (Decided & { readonly outcome: "accepted" })
  | (Decided & { readonly outcome: "rejected" })
  | (ResultBase & {
      readonly outcome: "unsupported";
      readonly reason: UnsupportedReason;
      readonly detail: string;
    })
  | (ResultBase & {
      /**
       * The library raised instead of answering.
       *
       * Distinct from `rejected`, which is a verdict, and from `adapterError`,
       * which is ours. An application driving the library this way would get an
       * exception rather than a 400, and scoring a raise as a rejection would
       * credit a library for reaching a verdict it never reached.
       *
       * Attributable to the library, so it appears in the matrix as a failure
       * of its own kind rather than folded into either neighbour.
       */
      readonly outcome: "libraryError";
      readonly detail: string;
      readonly raw: JsonValue;
    })
  | (ResultBase & {
      /** Our code broke. This must never render as a library failure. */
      readonly outcome: "adapterError";
      readonly detail: string;
      readonly raw: JsonValue;
    });

export type Outcome = AdapterResult["outcome"];
