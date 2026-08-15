import type { Adapter } from "../types/adapter";
import { delegatedSplits } from "../types/adapter";
import type { JsonValue } from "../types/json";
import type { OasVersion, OpenApiDocument } from "../types/openapi";
import type { WireRequest } from "../types/wire";
import type { PipelineStage, SplittableLocation } from "../types/pipeline";
import { ownsStage } from "../types/pipeline";
import type { Outcome, Preparse, ValueVantage } from "../types/result";
import type { CapabilityProbe, VersionProbe } from "./probes";
import { CAPABILITY_PROBES, VERSION_PROBES } from "./probes";
import { describePreparse, preparse, suppliedAnything } from "../wire/preparse";
import type { PreparsedRequest } from "../wire/preparse";

/**
 * What each declared stage did when it was probed.
 *
 * Stored per library alongside its answers, for the same reason the answers are
 * stored: a claim rendered in a report has to be traceable to what the library
 * returned, and a check that lives only in test output is unreviewable. The
 * record carries both sides' raw output, so a reader can disagree with the
 * reading rather than only with the verdict on it.
 *
 * Nothing here is scored. Whether a probe demonstrated a stage is derived from
 * the two outcomes by `demonstrates`, which is display's job and the gate's,
 * not the measurement's.
 */

/** What one side of a probe produced. */
export interface ProbeSide {
  readonly outcome: Outcome;
  /** Present for the outcomes that carry one: unsupported, and both error kinds. */
  readonly detail: string | null;
  readonly observation: "notReached" | "observed" | "unexposed" | null;
  readonly vantage: ValueVantage | null;
  /** Whether the value channel carried the probed parameter name. */
  readonly exposedProbedName: boolean;
  /** The library's own output, unedited. */
  readonly raw: JsonValue;
}

/**
 * What one specification version's probe showed for one library.
 *
 * Stored beside the stage evidence for the same reason: a version claim
 * rendered in a report has to be traceable to what the library returned. No
 * contradiction is constructible here, so nothing in this record can fail the
 * gate; it backs a claim, or records that nothing backed it, or records what a
 * disclaimed version did anyway.
 */
export interface VersionEvidence {
  readonly probeId: string;
  readonly oasVersion: OasVersion;
  readonly asks: string;
  readonly declared: boolean;
  readonly preparse: Preparse | null;
  readonly accepted: ProbeSide;
  readonly rejected: ProbeSide;
}

export interface CapabilityEvidence {
  readonly probeId: string;
  readonly stage: PipelineStage;
  /** What the harness supplied, which decides whether this entry is evidence. */
  readonly supply: "asDeclared" | "withProbedLocation" | "withoutProbedLocation";
  readonly location: SplittableLocation | null;
  readonly asks: string;
  /** What the adapter declared for this stage, at this location where it has one. */
  readonly declared: boolean;
  /**
   * What the harness supplied before the library saw the request, and `null`
   * when it supplied nothing. A cell that reads as the library's own recovery
   * has to be checkable against this.
   */
  readonly preparse: Preparse | null;
  readonly accepted: ProbeSide;
  readonly rejected: ProbeSide;
}

/**
 * The usual delegated split, minus one location.
 *
 * Withholding one location is the counterfactual a splitting claim needs.
 * Withholding everything changes more than one thing at a time, and a probe
 * that changes two things measures neither.
 */
function splitsFor(
  adapter: Adapter,
  probe: CapabilityProbe,
): Readonly<Record<SplittableLocation, boolean>> {
  const delegated = delegatedSplits(adapter.capabilities);
  if (probe.location === null || probe.supply === "asDeclared") return delegated;
  // Forced rather than read off the declaration, in both directions.
  // `delegatedSplits` already returns false for a location the library claims,
  // so deriving the withholding variant from it left the pair identical for
  // every claimed location and made the refutation unreachable.
  return { ...delegated, [probe.location]: probe.supply === "withProbedLocation" };
}

/**
 * Whether a probe demonstrated the stage it exercises.
 *
 * Derived rather than stored, and derived in one place so the gate and the
 * report cannot drift into two different readings of the same record.
 *
 * Value exposure reads its own way. The other stages are demonstrated by the
 * pair of verdicts, since a stage that changes what a library decides shows up
 * as deciding two inputs differently. Exposure changes nothing a library
 * decides: it is demonstrated by the accepted side carrying an observed value
 * for the parameter that was accepted.
 *
 * Three ways rather than a boolean, because `accepted / rejected` and
 * `accepted / raised` are not the same event, and this repository already
 * refuses to render those the same in the matrix. A raise is evidence the
 * library reached the stage: it noticed the input and threw there rather than
 * passing it through. It is not a verdict, and an application driving the
 * library that way gets an exception rather than a refusal. Both facts survive
 * into the report, which prints how a claim was demonstrated rather than only
 * that it was.
 */
export type Demonstration = "byExposedValue" | "byRaise" | "byVerdicts";

export function demonstratedBy(evidence: CapabilityEvidence): Demonstration | null {
  if (evidence.stage === "valueExposure") {
    // The accepted side has to have been accepted. A library that rejects the
    // valid input and reports values anyway has shown something about its
    // vantage rather than about the exposure this probe asks for.
    return evidence.accepted.outcome === "accepted" &&
      evidence.accepted.observation === "observed" &&
      evidence.accepted.exposedProbedName
      ? "byExposedValue"
      : null;
  }
  // A splitting probe run on the library's usual input proves nothing about
  // its splitting: the harness may have done it. Only the variant that
  // withholds the probed location is evidence, and the other is the control
  // that keeps a failure readable.
  if (evidence.stage === "splitting" && evidence.supply !== "withoutProbedLocation") return null;
  if (evidence.accepted.outcome !== "accepted") return null;
  if (evidence.rejected.outcome === "rejected") return "byVerdicts";
  if (evidence.rejected.outcome === "libraryError") return "byRaise";
  return null;
}

export function demonstrates(evidence: CapabilityEvidence): boolean {
  return demonstratedBy(evidence) !== null;
}

/**
 * How a version probe demonstrated the claim, or `null` when it did not.
 *
 * The same verdict pair as the stage probes: accepting the valid side and
 * rejecting the invalid one is evidence something read the document. A raise
 * on the invalid side is evidence the library reached the value and threw
 * there, and the report prints which of the two happened.
 */
export function versionDemonstratedBy(evidence: VersionEvidence): Demonstration | null {
  if (evidence.accepted.outcome !== "accepted") return null;
  if (evidence.rejected.outcome === "rejected") return "byVerdicts";
  if (evidence.rejected.outcome === "libraryError") return "byRaise";
  return null;
}

/** What the probes of one stage showed, and what they did not. */
export interface StageReading {
  readonly demonstratedBy: readonly string[];
  /** Probes of the stage that showed nothing, excluding the controls. */
  readonly notShownBy: readonly string[];
  /**
   * Probes that contradict the declaration rather than failing to support it.
   * Always empty for the stages where no such probe can be built.
   */
  readonly refutedBy: readonly string[];
}

/**
 * Whether a probe contradicts a claim of ownership, as opposed to failing to
 * support it.
 *
 * The distinction the gate turns on, and one an earlier version of this file
 * collapsed. Ownership is about who does the work: a library owns a
 * deserialization stage when it turns a raw wire value into a structured one
 * itself rather than requiring its caller to have done it. Whether it does that
 * correctly is a different question, and it is the one the corpus asks.
 *
 * A probe demonstrates ownership and almost never refutes it. "Owns the stage
 * and performs it differently from the specification" and "does not perform the
 * stage" produce the same pair of verdicts, because both reject the valid side.
 * One library in the roster converts a comma-joined array by reading it as
 * JSON, which fails every style probe while being, unmistakably, the library
 * doing the conversion itself. Reading that as absence would let any library
 * move its failures into `stageNotOwned` by disclaiming, which is worse than
 * the mislabelling the stage split was written to fix.
 *
 * Two refutations do exist, and both are positive findings rather than absent
 * evidence:
 *
 * - Splitting. The counterfactual is constructible, because supplying a split
 *   is upstream work the harness is allowed to do. A library that answers with
 *   the location supplied and fails without it has been shown to delegate it.
 * - Value exposure. Declaring it and reporting `unexposed` on every probe of
 *   it is the contradiction. One probe alone cannot carry it: a write-back
 *   channel has nothing to write on the ordinary accepted probe and shows
 *   itself on the probe built for it, so the reading is scoped by the sibling
 *   probes the way splitting's is scoped by its control.
 *
 * Every other stage would need the harness to deserialize downstream of the
 * probe to build the counterfactual, and the harness must never do that. So no
 * probe of them refutes anything, and this returns false.
 */
function refutes(evidence: CapabilityEvidence, siblings: readonly CapabilityEvidence[]): boolean {
  if (!evidence.declared) return false;
  if (evidence.stage === "valueExposure") {
    if (evidence.accepted.outcome !== "accepted" || evidence.accepted.observation !== "unexposed") {
      return false;
    }
    // Scoped by the sibling probes, the same shape as splitting's control. A
    // write-back channel has nothing to write on the ordinary accepted probe
    // and shows itself on the probe built for it, so `unexposed` there only
    // contradicts the claim when no exposure probe demonstrated it anywhere.
    return !siblings.some((entry) => entry !== evidence && demonstrates(entry));
  }
  if (evidence.stage !== "splitting" || evidence.supply !== "withoutProbedLocation") return false;
  if (demonstrates(evidence)) return false;
  // Refuted only when the control shows the library answering this same probe
  // once the harness supplies the location. Without that half, the failure
  // could be the library declining the input for some reason of its own, and
  // the gate would be reading an absence again.
  const control = siblings.find((entry) => entry.supply === "withProbedLocation");
  return (
    control !== undefined &&
    control.accepted.outcome === "accepted" &&
    control.rejected.outcome === "rejected"
  );
}

/**
 * What stands behind one stage, read from the probes of it.
 *
 * A stage counts as demonstrated when any probe of it demonstrates it, rather
 * than every one. The probes of a stage are not equivalent: style
 * deserialization is probed in three locations and a library can own it in some
 * and not others, which is a finding to publish rather than a declaration to
 * refuse.
 *
 * Nothing here is a judgement about a declaration. The gate refuses a
 * declaration only on `refutedBy`, and a declared stage sitting in `notShownBy`
 * is published as an unbacked claim rather than treated as a false one. Absence
 * of evidence is not evidence of absence, and a gate that read it that way
 * would manufacture findings out of probe blind spots.
 *
 * Corpus answers deliberately do not count either. Letting a conformance pass
 * stand in for a probe was considered and dropped: the only pass that would
 * evidence a stage is one whose expected values matched, a library that exposes
 * no values can never produce one whatever it does, and no declaration in the
 * roster rested on it. It decided nothing while coupling capability gating to
 * conformance scoring.
 */
export function stageReading(
  evidence: readonly CapabilityEvidence[],
  stage: PipelineStage,
  location: SplittableLocation | null,
): StageReading {
  const probes = evidence.filter((entry) => entry.stage === stage && entry.location === location);
  return {
    demonstratedBy: probes.filter(demonstrates).map((entry) => entry.probeId),
    notShownBy: probes
      .filter(
        (entry) =>
          !demonstrates(entry) && !(stage === "splitting" && entry.supply === "withProbedLocation"),
      )
      .map((entry) => entry.probeId),
    refutedBy: probes.filter((entry) => refutes(entry, probes)).map((entry) => entry.probeId),
  };
}

/**
 * Run every probe against one library.
 *
 * Driven through `adapter.run` rather than through the runner, deliberately.
 * The runner refuses a case whose stage a library disclaims, which is right for
 * the corpus and would make a disclaim unfalsifiable here: the probe that
 * exists to check a disclaim cannot be one the disclaim prevents.
 */
export async function runCapabilityEvidence(
  adapter: Adapter,
): Promise<readonly CapabilityEvidence[]> {
  const evidence: CapabilityEvidence[] = [];
  for (const probe of CAPABILITY_PROBES) {
    const preparsed = supplyFor(adapter, probe);
    evidence.push({
      probeId: probe.id,
      stage: probe.stage,
      supply: probe.supply,
      location: probe.location,
      asks: probe.asks,
      declared: ownsStage(
        adapter.capabilities.stages,
        probe.stage,
        // Only splitting is claimed per location, and only splitting probes
        // carry one. The placeholder is never read for the other stages.
        probe.location ?? "path",
      ),
      // The accepted side's split. Both sides are supplied the same way and
      // differ only in the value being split, so one record says what the
      // harness did without printing the same description twice.
      preparse: suppliedAnything(preparsed) ? describePreparse(preparsed) : null,
      accepted: await side(adapter, probe, "accept"),
      rejected: await side(adapter, probe, "reject"),
    });
  }
  return evidence;
}

/**
 * Run the version probes against one library.
 *
 * Every version the protocol knows is probed, declared or not, the same rule
 * as the stage probes: the probe that exists to check a disclaim cannot be one
 * the disclaim prevents. The harness supplies the library's usual delegated
 * split, because the probe asks about the document's version and must change
 * nothing else.
 */
export async function runVersionEvidence(adapter: Adapter): Promise<readonly VersionEvidence[]> {
  const evidence: VersionEvidence[] = [];
  for (const probe of VERSION_PROBES) {
    const supplied = preparse(probe.document, probe.accept, delegatedSplits(adapter.capabilities));
    evidence.push({
      probeId: probe.probeId,
      oasVersion: probe.oasVersion,
      asks: probe.asks,
      declared: adapter.capabilities.oasVersions[probe.oasVersion],
      preparse: suppliedAnything(supplied) ? describePreparse(supplied) : null,
      accepted: await versionSide(adapter, probe, "accept"),
      rejected: await versionSide(adapter, probe, "reject"),
    });
  }
  return evidence;
}

async function versionSide(
  adapter: Adapter,
  probe: VersionProbe,
  which: "accept" | "reject",
): Promise<ProbeSide> {
  const wire = which === "accept" ? probe.accept : probe.reject;
  const supplied = preparse(probe.document, wire, delegatedSplits(adapter.capabilities));
  return runSide(adapter, { id: probe.probeId, document: probe.document }, wire, supplied);
}

function supplyFor(adapter: Adapter, probe: CapabilityProbe): PreparsedRequest {
  return preparse(probe.document, probe.accept, splitsFor(adapter, probe));
}

async function side(
  adapter: Adapter,
  probe: CapabilityProbe,
  which: "accept" | "reject",
): Promise<ProbeSide> {
  const wire = which === "accept" ? probe.accept : probe.reject;
  // Split from this side's own target. Handing one side the other side's
  // values would feed the library the accepted value while telling it the
  // rejected story, and the probe would then measure nothing at all.
  const supplied = preparse(probe.document, wire, splitsFor(adapter, probe));
  return runSide(adapter, { id: probe.id, document: probe.document }, wire, supplied);
}

async function runSide(
  adapter: Adapter,
  probeCase: { id: string; document: OpenApiDocument },
  wire: WireRequest,
  supplied: PreparsedRequest,
): Promise<ProbeSide> {
  try {
    const result = await adapter.run(probeCase, wire, supplied);
    if (result.outcome === "accepted" || result.outcome === "rejected") {
      const { deserialized } = result;
      return {
        outcome: result.outcome,
        detail: null,
        observation: deserialized.kind,
        vantage: deserialized.kind === "observed" ? deserialized.vantage : null,
        exposedProbedName:
          deserialized.kind === "observed" && Object.hasOwn(deserialized.value, "p"),
        raw: result.raw,
      };
    }
    return {
      outcome: result.outcome,
      detail: result.detail,
      observation: null,
      vantage: null,
      exposedProbedName: false,
      raw: result.outcome === "unsupported" ? null : result.raw,
    };
  } catch (error) {
    // An adapter that throws is ours, and is recorded as ours. A probe cannot
    // report a harness fault as a library's failure to demonstrate a stage.
    return {
      outcome: "adapterError",
      detail: error instanceof Error ? error.message : String(error),
      observation: null,
      vantage: null,
      exposedProbedName: false,
      raw: null,
    };
  }
}
