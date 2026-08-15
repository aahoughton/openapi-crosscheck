import type { Adapter } from "../types/adapter";
import type { Case } from "../types/case";
import type { AdapterResult } from "../types/result";
import type { CaseAnswer, LibraryMeasurement } from "../types/measurement";
import { MEASUREMENT_SCHEMA_VERSION } from "../types/measurement";
import { delegatedSplits } from "../types/adapter";
import { canBeAsked, probedStage } from "../types/pipeline";
import { describePreparse, preparse, suppliedAnything } from "../wire/preparse";
import { runCapabilityEvidence, runVersionEvidence } from "../capability/evidence";
import { corpusDigest } from "../corpus/digest";

/**
 * Drive every case through one library and return that library's measurement.
 *
 * Per library rather than per case, because a measurement of one library is the
 * unit this project produces. Running against a single library is then the
 * ordinary path rather than a degenerate case of comparing several, and nothing
 * a library answers depends on which other libraries were present.
 *
 * The one judgement made here is the stage guard, and it is made before any
 * adapter code runs: a library is asked a case when it owns the stage that case
 * exists to probe, whatever the harness had to do upstream to get the request
 * that far. A looser rule attributes the harness's own work to a library; a
 * stricter one discards answers a library demonstrably gives. The runner issues
 * the `unsupported` itself so no library-specific code is even on the path.
 */
export async function measure(
  cases: readonly Case[],
  adapter: Adapter,
): Promise<LibraryMeasurement> {
  const answers: CaseAnswer[] = [];
  for (const testCase of cases) {
    answers.push({ caseId: testCase.id, result: await runOne(testCase, adapter) });
  }
  return {
    schemaVersion: MEASUREMENT_SCHEMA_VERSION,
    library: adapter.library,
    libraryVersion: adapter.libraryVersion,
    librarySource: adapter.librarySource,
    libraryResolution: adapter.libraryResolution,
    corpusDigest: corpusDigest(cases),
    capabilities: adapter.capabilities,
    capabilityEvidence: await runCapabilityEvidence(adapter),
    versionEvidence: await runVersionEvidence(adapter),
    configuration: adapter.configuration,
    provenance: adapter.provenance,
    answers,
  };
}

/**
 * Measure several libraries, in the order they were given.
 *
 * A thin loop on purpose. Comparison is a reader of measurements rather than a
 * different way of producing them, so there is no aggregate shape here that a
 * single-library run would lack.
 */
export async function measureAll(
  cases: readonly Case[],
  adapters: readonly Adapter[],
): Promise<readonly LibraryMeasurement[]> {
  const measurements: LibraryMeasurement[] = [];
  for (const adapter of adapters) measurements.push(await measure(cases, adapter));
  return measurements;
}

async function runOne(testCase: Case, adapter: Adapter): Promise<AdapterResult> {
  const { location } = testCase.dimensions;
  const stage = probedStage(testCase.dimensions);
  // Version first, stage second: whether the library was claimed to read this
  // document at all comes before any reasoning about who performs which stage
  // of a request against it.
  if (adapter.capabilities.oasVersions[testCase.oasVersion] !== true) {
    return {
      library: adapter.library,
      libraryVersion: adapter.libraryVersion,
      configurationId: adapter.configuration.id,
      preparse: null,
      outcome: "unsupported",
      reason: "oasVersionNotDeclared",
      detail:
        `this case's document is OpenAPI ${testCase.oasVersion}, which this container ` +
        "does not declare its library accepts, so no request was made and nothing " +
        "here says how the library would have answered",
    };
  }
  if (!canBeAsked(adapter.capabilities.stages, testCase.dimensions)) {
    return {
      library: adapter.library,
      libraryVersion: adapter.libraryVersion,
      configurationId: adapter.configuration.id,
      preparse: null,
      outcome: "unsupported",
      reason: "stageNotOwned",
      detail:
        `this case probes ${stage} for a ${location} parameter; reaching a verdict ` +
        "needs every stage the case travels through from there, and for a content " +
        "parameter also the media type parsing upstream of it, and this library " +
        "leaves at least one of those to its caller, so an answer would measure " +
        "the harness",
    };
  }

  // Computed here, never by an adapter. `performedBy: "harness"` has to be
  // stamped by the harness or it is just a claim an adapter makes about itself.
  //
  // Per location, so the record says what was supplied for this library rather
  // than what the splitter can do. A library recovering its own path parameters
  // is handed none, and its cells do not claim otherwise.
  const preparsed = preparse(
    testCase.document,
    testCase.request,
    delegatedSplits(adapter.capabilities),
  );
  const supplied = suppliedAnything(preparsed);

  try {
    const result = await adapter.run(testCase, testCase.request, preparsed);
    return { ...result, preparse: supplied ? describePreparse(preparsed) : null };
  } catch (error) {
    // An adapter that throws is our defect, never the library's.
    return {
      library: adapter.library,
      libraryVersion: adapter.libraryVersion,
      configurationId: adapter.configuration.id,
      preparse: null,
      outcome: "adapterError",
      detail: error instanceof Error ? error.message : String(error),
      raw: null,
    };
  }
}

export async function disposeAll(adapters: readonly Adapter[]): Promise<void> {
  for (const adapter of adapters) await adapter.dispose?.();
}
