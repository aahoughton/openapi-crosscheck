import type { PipelineStage, SplittableLocation } from "../types/pipeline";
import { PIPELINE_STAGES, SPLITTABLE_LOCATIONS } from "../types/pipeline";
import type { AdapterResult, ValueVantage } from "../types/result";
import { tableCell } from "./markdown";
import type { ConformanceOutcome } from "./score";

/**
 * The words every reading of a measurement puts in a cell.
 *
 * One module so that a verdict, a set of values, an outcome and a stage read
 * the same in the markdown, on the page and in a comparison of two runs. Each
 * function here has a plain-text form; the markdown forms add code spans and
 * go through `tableCell`, and nothing else differs between them.
 */

/**
 * Every outcome a conformance cell can hold, in the order a tally lists them.
 */
export const CONFORMANCE_OUTCOMES: readonly ConformanceOutcome[] = [
  "pass",
  "passVerdictOnly",
  "passValuesNotReached",
  "passValuesUnreadable",
  "failVerdict",
  "failValue",
  "libraryError",
  "adapterError",
  "notApplicable",
];

/** What a conformance cell reads, in every rendering. */
export const OUTCOME_LABEL: Readonly<Record<ConformanceOutcome, string>> = {
  pass: "pass",
  passVerdictOnly: "pass (verdict only)",
  passValuesNotReached: "pass (values not reached)",
  passValuesUnreadable: "pass (value unreadable here)",
  failVerdict: "FAIL (verdict)",
  failValue: "FAIL (value)",
  libraryError: "RAISED",
  adapterError: "harness error",
  notApplicable: "n/a",
};

/** What each outcome means, one sentence or two each. */
export const OUTCOME_NOTE: Readonly<Record<ConformanceOutcome, string>> = {
  pass: "The verdict the specification settles, and its values where the specification settles those too.",
  passVerdictOnly:
    "The settled verdict, from a library that exposes no deserialized values, so the value half of the case could not be asked of it.",
  passValuesNotReached:
    "The settled verdict, from a library that exposes values and reported reaching none on this request, so the value half has nothing to compare.",
  passValuesUnreadable:
    "The settled verdict, and every expected value this container could read matched. At least one expected parameter has no slot in the request shape this library takes, so its value was never put to the library.",
  failVerdict: "It reached the opposite verdict.",
  failValue:
    "It reached the settled verdict and handed back values the specification settles differently.",
  libraryError:
    "It threw instead of answering, which is attributable to it. An application would have seen an exception rather than a refusal.",
  adapterError: "An error in the adapter or the harness rather than an answer from the library.",
  notApplicable:
    "No request verdict was measured. The cell reason names the version, stage, public input, library input shape, or adapter boundary that stopped it.",
};

/**
 * The verdict a measurement returned, keeping a refusal to ask, a raise and a
 * harness fault apart from a verdict.
 */
export function verdictText(result: AdapterResult | undefined): string {
  if (result === undefined) return "-";
  if (result.outcome === "unsupported") return `not asked (${result.reason})`;
  if (result.outcome === "adapterError") return "harness error";
  if (result.outcome === "libraryError") return "raised, no verdict";
  return result.outcome;
}

/** `verdictText`, made safe for a markdown table cell. */
export function verdictCell(result: AdapterResult | undefined): string {
  return tableCell(verdictText(result));
}

/**
 * From what point the values were read.
 *
 * Without this an absent parameter name reads the same across the roster while
 * meaning three different things, and an empty object reads as "returned
 * nothing" when it can mean "withheld because it did not pass".
 */
export function vantageText(vantage: ValueVantage): string {
  if (vantage === "handedToHandler") return "handed to the handler";
  if (vantage === "parsedBeforeValidation") return "parsed before validation";
  return "validated only, so an absent name failed its schema";
}

/** The vantages in the order the type declares them. */
export const VANTAGES: readonly ValueVantage[] = [
  "handedToHandler",
  "parsedBeforeValidation",
  "validatedOnly",
];

/**
 * The value channel of one answer, keeping its observations distinct.
 *
 * `code` wraps the parts a library or a container wrote verbatim: the values
 * and the parameter names. The plain form passes the identity; the markdown
 * form passes a code span.
 */
function valuesWith(result: AdapterResult | undefined, code: (text: string) => string): string {
  if (result === undefined) return "-";
  if (result.outcome !== "accepted" && result.outcome !== "rejected") return "-";
  const observation = result.deserialized;
  if (observation.kind === "unexposed") return `not exposed by this library (${observation.reason})`;
  if (observation.kind === "notReached") return `none reached (${observation.reason})`;
  // A parameter the container could not read is absent from `value` exactly as
  // a parameter the library reported nothing for is, so it is named with its
  // reason rather than left to look like the second.
  const unreadable = Object.entries(observation.unreadable ?? {}).sort(([one], [other]) =>
    one < other ? -1 : 1,
  );
  const gap =
    unreadable.length === 0
      ? ""
      : `, and this container could not read ${unreadable
          .map(([name, reason]) => `${code(name)} (${reason})`)
          .join(", ")}`;
  return `${code(JSON.stringify(observation.value))} (${vantageText(observation.vantage)})${gap}`;
}

/** The value channel as plain text, for a page or a terminal. */
export function valuesText(result: AdapterResult | undefined): string {
  return valuesWith(result, (text) => text);
}

/** The value channel for a markdown table cell. */
export function valuesCell(result: AdapterResult | undefined): string {
  return tableCell(valuesWith(result, (text) => `\`${text}\``));
}

/**
 * One slot a stage declaration can fill: the stages, with splitting once per
 * location because that is how it is claimed.
 *
 * Enumerated rather than derived from what any library declared, so a stage no
 * library claims still gets a row saying so.
 */
export interface StageSlot {
  readonly stage: PipelineStage;
  readonly location: SplittableLocation | null;
  /** The slot as the pipeline names it, for a reader matching it to the code. */
  readonly title: string;
  /** The slot in plain words, for a table column or row. */
  readonly label: string;
  /** What work this slot names, for a reader who has not read `pipeline.ts`. */
  readonly description: string;
}

/**
 * What each stage is, in one sentence.
 *
 * Splitting is described per location because the work differs by location and
 * the difference is why the stage is split at all: a query string is parsed on
 * delimiters, a path segment is read against a template, and a header arrives
 * named by whoever built the map.
 */
const STAGE_DESCRIPTIONS: Readonly<Record<PipelineStage, string>> = {
  routing: "Match the method and target of a request to an operation in the document.",
  splitting: "Recover each declared parameter's raw value from the request.",
  styleDeserialization:
    "Apply the declared style and explode to a raw value to produce a structured one.",
  contentDeserialization:
    "Read a raw value as a representation of the media type the parameter declares.",
  schemaValidation: "Coerce a value to its declared type and validate it against the schema.",
  valueExposure: "Hand the deserialized values back to the caller, where they can be read.",
};

const STAGE_LABELS: Readonly<Record<PipelineStage, string>> = {
  routing: "routing",
  splitting: "splitting",
  styleDeserialization: "style and explode",
  contentDeserialization: "content media type",
  schemaValidation: "schema validation",
  valueExposure: "value exposure",
};

const SPLIT_DESCRIPTIONS: Readonly<Record<SplittableLocation, string>> = {
  cookie: "Split the Cookie header into crumbs and find the declared name among them.",
  header: "Find the declared name among the headers received, whatever their casing.",
  path: "Read the request target against the path template to recover each segment.",
  query: "Split the query string on its delimiters into names and raw values.",
};

/** Every stage a declaration can fill, splitting once per location. */
export const STAGE_SLOTS: readonly StageSlot[] = PIPELINE_STAGES.flatMap((stage): StageSlot[] =>
  stage === "splitting"
    ? SPLITTABLE_LOCATIONS.map((location) => ({
        stage,
        location,
        title: `split: ${location}`,
        label: `split: ${location}`,
        description: SPLIT_DESCRIPTIONS[location],
      }))
    : [
        {
          stage,
          location: null,
          title: stage,
          label: STAGE_LABELS[stage],
          description: STAGE_DESCRIPTIONS[stage],
        },
      ],
);
