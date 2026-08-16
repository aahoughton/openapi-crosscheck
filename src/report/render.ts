import type { Case, Citation, ConformanceCase } from "../types/case";
import type { OasVersion, ParameterLocation } from "../types/openapi";
import type { PipelineStage } from "../types/pipeline";
import type { SplittableLocation } from "../types/pipeline";
import { PIPELINE_STAGES, SPLITTABLE_LOCATIONS, ownsStage, probedStage } from "../types/pipeline";
import type { AdapterResult, ValueVantage } from "../types/result";
import type { LibraryMeasurement } from "../types/measurement";
import { MEASUREMENT_SCHEMA_VERSION } from "../types/measurement";
import { renderLibrary } from "./display";
import type { CoverageView } from "./view";
import {
  coverage,
  matrixFileName,
  orderMeasurements,
  placeContentCases,
  presentVersions,
  versionSlug,
} from "./view";
import { adjudications } from "../corpus/adjudications";
import { externalFigures } from "../corpus/provenance";
import {
  CONTENT_MEDIA_TYPES,
  LOCATIONS,
  PROBE_AXES,
  cellKey,
  contentCellKey,
  definedSurface,
} from "../surface/surface";
import type { CapabilityEvidence, ProbeSide } from "../capability/evidence";
import { demonstratedBy, demonstrates, stageReading, versionDemonstratedBy } from "../capability/evidence";
import { score } from "./score";

/**
 * Everything written to `report/`, keyed by path.
 *
 * A map rather than a fixed set of names, because how many files there are now
 * depends on how many libraries were measured. Running against one library
 * writes one library's files and the comparison artifacts over a roster of one.
 */
export type Artifacts = Record<string, string>;

const OUTCOME_SYMBOL: Record<string, string> = {
  pass: "pass",
  passVerdictOnly: "pass (verdict only)",
  failVerdict: "FAIL (verdict)",
  failValue: "FAIL (value)",
  notApplicable: "n/a",
  libraryError: "RAISED",
  adapterError: "harness error",
};

/**
 * The questions, serialized.
 *
 * Written by `measure` before any container is asked, so a run directory says
 * what was asked even if it dies before anything answers. Emitted separately
 * from the answers because it depends on no library, and because a runner in
 * another language needs exactly this to ask the same ones.
 */
export function renderCorpus(cases: readonly Case[]): string {
  return `${JSON.stringify({ schemaVersion: MEASUREMENT_SCHEMA_VERSION, cases }, null, 2)}\n`;
}

/** One library's answers, serialized. The measurement, and the thing rendered from. */
export function renderMeasurement(measurement: LibraryMeasurement): string {
  return `${JSON.stringify(measurement, null, 2)}\n`;
}

/**
 * Render every markdown reading of a corpus and a set of measurements.
 *
 * The JSON is the measurement and the markdown is a reading of it. Everything
 * markdown says is derived from what the JSON already contains, so a reader can
 * trace a rendered cell to the document it came from, and a reader who wants a
 * different presentation has the measurement without needing this code at all.
 *
 * A pure function of what a run directory holds, which is what lets the gate
 * check every rendered byte without Docker: read the corpus and the
 * measurements off disk, render, compare.
 *
 * Ordered here rather than trusted from the caller. Every row and every column
 * below is drawn in the order this list arrives in, so the caller's order is
 * the report's order, and a caller that collected the files any other way would
 * put a library first without meaning to.
 */
export function renderMarkdown(
  cases: readonly Case[],
  measurements: readonly LibraryMeasurement[],
): Artifacts {
  const ordered = orderMeasurements(measurements);
  const view = coverage(cases);
  const artifacts: Artifacts = {};
  for (const measurement of ordered) {
    artifacts[`libraries/${measurement.provenance.slug}.md`] = renderLibrary(cases, measurement);
  }
  artifacts["README.md"] = renderReadme(cases, ordered, view);
  artifacts["fitness.md"] = renderFitness(cases, ordered);
  for (const version of presentVersions(cases)) {
    const versionCases = cases.filter((c) => c.oasVersion === version);
    artifacts[matrixFileName(version)] = renderMatrix(version, versionCases, ordered);
    artifacts[`coverage.${versionSlug(version)}.md`] = renderCoverage(version, versionCases);
  }
  artifacts["capabilities.md"] = renderCapabilities(cases, ordered);
  return artifacts;
}


/** Join measurements back into a per-case view. Comparison is a reader. */
function resultsFor(
  measurements: readonly LibraryMeasurement[],
  caseId: string,
): readonly AdapterResult[] {
  return measurements.flatMap((measurement) => {
    const answer = measurement.answers.find((entry) => entry.caseId === caseId);
    return answer === undefined ? [] : [answer.result];
  });
}

function renderMatrix(
  version: OasVersion,
  cases: readonly Case[],
  measurements: readonly LibraryMeasurement[],
): string {
  const columns = measurements.map((measurement) => measurement.library);
  const lines: string[] = [];

  lines.push(`# Cross-library request validation matrix, OpenAPI ${version}`);
  lines.push("");
  lines.push("Every case against every library: what each one was asked, what it answered,");
  lines.push("and where the specification says there is a right answer at all. Conformance");
  lines.push("comes first, then the cases the specification leaves open. `README.md` in this");
  lines.push("directory says what a case is and what the two kinds mean.");
  lines.push("");
  lines.push("Generated by `pnpm render-md`. Every cell traces to");
  lines.push("`report/libraries/<slug>.json` by case id and library name. Libraries appear");
  lines.push("in alphabetical order of package name, read from its first letter or digit,");
  lines.push("so an ecosystem's leading punctuation does not decide who comes first.");
  lines.push("");
  lines.push("In this file: [the libraries measured](#libraries-measured), the");
  lines.push("[conformance outcomes](#conformance) with");
  lines.push("[every case written out](#conformance-cases-in-full), and the");
  lines.push("[divergence findings](#divergence). Case ids link to the case in full,");
  lines.push("and library names link to that library's own page.");
  lines.push("");
  lines.push("No conformance outcome is totalled across libraries here. Libraries are");
  lines.push("asked different numbers of cases, so each library's outcome counts have a");
  lines.push("denominator of their own, and a column of them would rank libraries against");
  lines.push("denominators they do not share. Across libraries this report says which case");
  lines.push("produced which outcome, and outcome counts appear only in a single library's");
  lines.push("own file, beside the denominator they came from.");
  lines.push("");
  lines.push("Other counts are published where they describe rather than score: the");
  lines.push(`specification surface in \`coverage.${versionSlug(version)}.md\`, and what each`);
  lines.push("library exposed in");
  lines.push("`capabilities.md`. Nothing in those is measured against an expected answer,");
  lines.push("which is what separates a description of a library's shape from a verdict on");
  lines.push("its correctness.");
  lines.push("");
  lines.push("Whether these measurements still match the libraries is established only by");
  lines.push("`pnpm check:containers`, which rebuilds every container and re-asks every");
  lines.push("question. The fast gate rebuilds this file from the committed measurements,");
  lines.push("so it says this file matches that JSON and says nothing about the JSON. The");
  lines.push("file the run writes to record when it happened is not committed, so this");
  lines.push("file carries no measurement date: the version and image id below say what was");
  lines.push("measured rather than when.");
  lines.push("");
  lines.push("## Libraries measured");
  lines.push("");
  lines.push("A configuration names how the library was constructed and driven: which");
  lines.push("published call the adapter made, with what options, and which locations it");
  lines.push("handed over already split. Every result carries one because configuration is");
  lines.push("a confound, and a library rejecting everything may be misconfigured rather");
  lines.push("than strict. Two measurements of one library under different configurations");
  lines.push("are simply two measurements.");
  lines.push("");
  lines.push("The id below is a handle. The configuration it names is written out in full");
  lines.push("on `libraries/<name>.md`, and is in `libraries/<name>.json` with the options");
  lines.push("it was given.");
  lines.push("");
  lines.push("| library | version | configuration |");
  lines.push("| --- | --- | --- |");
  for (const adapter of measurements) {
    lines.push(
      `| [\`${adapter.library}\`](libraries/${adapter.provenance.slug}.md) | ` +
        `${adapter.libraryVersion} | \`${adapter.configuration.id}\` |`,
    );
  }
  lines.push("");

  lines.push("### Provenance");
  lines.push("");
  lines.push("The image each library answered from. Libraries are installed from their");
  lines.push("public registry at the current release resolved when the image is built, so");
  lines.push("the version says what was measured and the image id identifies the built");
  lines.push("environment. Two runs a month apart can report the same version and differ in");
  lines.push("a transitive dependency; the image id is the handle for the image that");
  lines.push("answered.");
  lines.push("");
  lines.push("| library | built from | image |");
  lines.push("| --- | --- | --- |");
  for (const entry of measurements) {
    lines.push(
      `| \`${entry.library}\` | \`adapters/${entry.provenance.slug}/\` | ` +
        `\`${entry.provenance.imageId}\` |`,
    );
  }
  lines.push("");

  lines.push("## Conformance");
  lines.push("");
  lines.push("The specification requires one answer to each of these, so a failure is");
  lines.push("attributable to the library, and the text that requires it is quoted with the");
  lines.push("case.");
  lines.push("");
  lines.push("### Outcome by library");
  lines.push("");
  lines.push("Each case id links to the case in full below: the request it sends, the");
  lines.push("rules the expected verdict rests on, and the argument for it.");
  lines.push("");
  lines.push(`| case | expected | ${columns.map((c) => `\`${c}\``).join(" | ")} |`);
  lines.push(`| --- | --- | ${columns.map(() => "---").join(" | ")} |`);
  const conformance = cases.filter((c): c is ConformanceCase => c.tier === "conformance");
  for (const testCase of conformance) {
    const results = resultsFor(measurements, testCase.id);
    const cells = measurements.map((adapter) => {
      const result = results.find((r) => r.library === adapter.library);
      return result === undefined ? "-" : (OUTCOME_SYMBOL[score(testCase, result)] ?? "?");
    });
    lines.push(`| [\`${testCase.id}\`](#${testCase.id}) | ${testCase.expected} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("Legend: `pass (verdict only)` means the library reached the right verdict and");
  lines.push("exposes no deserialized values, so the value half of the case could not be");
  lines.push("asked of it. `n/a` means the library was never asked, and why is in");
  lines.push("`capabilities.md`. `RAISED` means the library threw instead of answering, which is");
  lines.push("attributable to it and is not a rejection: an application would have seen an");
  lines.push("exception rather than a refusal. `harness error` is an error in the adapter or");
  lines.push("the harness, not an answer from the library.");
  lines.push("");

  lines.push("### Conformance cases in full");
  lines.push("");
  lines.push("Grouped by the location the parameter is declared in, in the order of the");
  lines.push("table above within each group.");
  lines.push("");
  let conformanceGroup = "";
  for (const testCase of conformance) {
    const group = locationGroup(testCase.dimensions.location);
    if (group !== conformanceGroup) {
      conformanceGroup = group;
      lines.push(`#### ${group}`);
      lines.push("");
    }
    lines.push(`##### \`${testCase.id}\``);
    lines.push("");
    lines.push(`${testCase.title}. Expected: **${testCase.expected}**.`);
    lines.push("");
    lines.push(testCase.inShort);
    lines.push("");
    lines.push(`Request: \`${testCase.request.method} ${testCase.request.target}\``);
    const extraHeaders = testCase.request.headers.filter(([name]) => name !== "Host");
    if (extraHeaders.length > 0) {
      lines.push("");
      for (const [name, value] of extraHeaders) lines.push(`Header: \`${name}: ${value}\``);
    }
    lines.push("");
    lines.push(
      `Every rule the expected verdict rests on, OpenAPI ${testCase.oasVersion}:`,
    );
    lines.push("");
    for (const citation of testCase.citations) {
      lines.push(`[${citation.anchor}](${citation.url})`);
      lines.push("");
      lines.push(`> ${citation.quoted}`);
      lines.push("");
    }
    lines.push(testCase.rationale);
    lines.push("");
    const adjudication = adjudications.find((entry) => entry.caseId === testCase.id);
    if (adjudication !== undefined) {
      lines.push(
        `Adjudicated ${adjudication.date} by ${adjudication.by}: ${adjudication.conclusion}`,
      );
      lines.push("");
    }
    lines.push(`Varies: ${list(testCase.varies)}. Holds constant: ${list(testCase.holdsConstant)}.`);
    lines.push("");
  }

  lines.push("## Divergence");
  lines.push("");
  lines.push("The specification requires no particular answer to these. The table reports what");
  lines.push("each library returned. No cell is a failure and nothing here is attributed to");
  lines.push("anyone.");
  lines.push("");
  lines.push("The value column is what the library parsed, which is not always what an");
  lines.push("application would receive: some libraries expose parsed values even for a");
  lines.push("request they rejected, and a rejected request reaches no handler.");
  lines.push("");
  lines.push("Each row holds two separate results, and the key for both is:");
  lines.push("");
  lines.push("| result | meaning |");
  lines.push("| --- | --- |");
  lines.push("| `accepted`, `rejected` | the verdict the library reached on the request |");
  lines.push(
    "| `raised, no verdict` | it threw instead of answering, which is attributable to it " +
      "and is not a rejection: an application would have seen an exception |",
  );
  lines.push(
    "| `not asked (<reason>)` | it was never given the case, because it does not perform " +
      "the stage the case probes; `capabilities.md` has the reason in full |",
  );
  lines.push(
    "| `harness error` | an error in the adapter or the harness rather than an answer " +
      "from the library |",
  );
  lines.push(
    "| `` `{\"p\":\"blue\"}` `` | the values it handed back, as it returned them, with the " +
      "vantage they were read from |",
  );
  lines.push(
    "| `not exposed by this library` | it reached a verdict and publishes no call that " +
      "returns deserialized values, which is a fact about the library rather than about " +
      "this request |",
  );
  lines.push("| `none reached` | it does expose values, and produced none here |");
  lines.push(
    "| `and this container could not read `p`` | the parameter has no slot in the request " +
      "shape this library takes, so it was never put to the library. A different fact from " +
      "the library reporting no value for it |",
  );
  lines.push("");
  lines.push("A case marked **answered in the values** is one the verdict cannot carry: every");
  lines.push("reading of the specification accepts the request, and what separates them is");
  lines.push("what comes back. A library exposing no values reaches a verdict on such a case");
  lines.push("and answers nothing by it, so read those tables down the value column alone.");
  lines.push("");
  const divergence = cases.filter((c) => c.tier === "divergence");
  let divergenceGroup = "";
  for (const testCase of divergence) {
    if (testCase.tier !== "divergence") continue;
    const group = locationGroup(testCase.dimensions.location);
    if (group !== divergenceGroup) {
      divergenceGroup = group;
      lines.push(`### ${group}`);
      lines.push("");
    }
    lines.push(`#### \`${testCase.id}\``);
    lines.push("");
    lines.push(`${testCase.title}.`);
    lines.push("");
    lines.push(testCase.inShort);
    lines.push("");
    lines.push(`Request: \`${testCase.request.method} ${testCase.request.target}\``);
    const extraHeaders = testCase.request.headers.filter(([name]) => name !== "Host");
    if (extraHeaders.length > 0) {
      lines.push("");
      for (const [name, value] of extraHeaders) lines.push(`Header: \`${name}: ${value}\``);
    }
    lines.push("");
    lines.push(`Open question: ${testCase.question}`);
    lines.push("");
    if (testCase.answeredInValues === true) {
      lines.push(
        "**Answered in the values.** The verdict cannot carry this finding, so a library " +
          "that exposes no deserialized values reaches a verdict here and answers nothing " +
          "by it.",
      );
      lines.push("");
    }
    if (testCase.basis !== null) {
      lines.push(
        `The text leaving it open: [${testCase.basis.anchor}](${testCase.basis.url})`,
      );
      lines.push("");
      lines.push(`> ${testCase.basis.quoted}`);
      lines.push("");
    }
    lines.push("| library | verdict | parsed values exposed by the library |");
    lines.push("| --- | --- | --- |");
    for (const adapter of measurements) {
      const result = resultsFor(measurements, testCase.id).find((r) => r.library === adapter.library);
      lines.push(
        `| \`${adapter.library}\` | ${verdictOf(result)} | ${valuesOf(result)} |`,
      );
    }
    lines.push("");
    const adjudication = adjudications.find((entry) => entry.caseId === testCase.id);
    if (adjudication !== undefined) {
      lines.push(
        `Adjudicated ${adjudication.date} by ${adjudication.by}: ${adjudication.conclusion}`,
      );
      lines.push("");
    }
    lines.push(`Varies: ${list(testCase.varies)}. Holds constant: ${list(testCase.holdsConstant)}.`);
    lines.push("");
  }

  return `${lines.join("\n")}`;
}

/** The heading a case files under when the cases in full are grouped. */
function locationGroup(location: string): string {
  return `${location.charAt(0).toUpperCase()}${location.slice(1)} parameters`;
}

function verdictOf(result: AdapterResult | undefined): string {
  if (result === undefined) return "-";
  if (result.outcome === "unsupported") return `not asked (${result.reason})`;
  if (result.outcome === "adapterError") return "harness error";
  if (result.outcome === "libraryError") return "raised, no verdict";
  return result.outcome;
}

function valuesOf(result: AdapterResult | undefined): string {
  if (result === undefined || result.outcome === "unsupported") return "-";
  if (result.outcome === "adapterError" || result.outcome === "libraryError") return "-";
  const observation = result.deserialized;
  if (observation.kind === "unexposed") return `not exposed by this library (${observation.reason})`;
  if (observation.kind === "notReached") return `none reached (${observation.reason})`;
  // Named rather than left out. A parameter the container could not read is
  // absent from `value` exactly as a parameter the library reported nothing for
  // is, and a cell that prints only the values it has says the second when the
  // first is true.
  const unreadable = Object.entries(observation.unreadable ?? {}).sort(([one], [other]) =>
    one < other ? -1 : 1,
  );
  const gap =
    unreadable.length === 0
      ? ""
      : `, and this container could not read ${unreadable
          .map(([name, reason]) => `\`${name}\` (${reason})`)
          .join(", ")}`;
  return `\`${JSON.stringify(observation.value)}\` (${vantageOf(observation.vantage)})${gap}`;
}

/**
 * Say from what point the values were read. Without this an absent parameter
 * name reads the same across the roster while meaning three different things,
 * and an empty object reads as "returned nothing" when it can mean "withheld
 * because it did not pass".
 */
function vantageOf(vantage: ValueVantage): string {
  if (vantage === "handedToHandler") return "handed to the handler";
  if (vantage === "parsedBeforeValidation") return "parsed before validation";
  return "validated only, so an absent name failed its schema";
}

function list(items: readonly string[]): string {
  return items.length === 0 ? "nothing" : items.join("; ");
}

function renderCoverage(version: OasVersion, cases: readonly Case[]): string {
  // The surface table enumerates style serialization, so only cases declared
  // with `schema` belong in it. A `content` parameter has no style to place.
  const styled = cases.flatMap((c) =>
    c.dimensions.declaration === "schema" ? [c.dimensions] : [],
  );
  const covered = new Set(styled.map((dimensions) => cellKey(dimensions)));
  const surface = definedSurface(version);
  const filled = surface.filter((cell) => covered.has(cellKey(cell)));

  const lines: string[] = [];
  lines.push(`# Coverage, OpenAPI ${version}`);
  lines.push("");
  lines.push("Enumerated from the specification, not from the corpus. A corpus-derived map");
  lines.push("would be complete by construction and would say nothing. Every empty cell");
  lines.push("below is a case nobody has written yet.");
  lines.push("");
  lines.push(
    `Defined combinations: ${String(surface.length)}. Covered: ${String(filled.length)}. ` +
      `Empty: ${String(surface.length - filled.length)}.`,
  );
  lines.push("");
  lines.push("Combinations the specification marks undefined are excluded from the surface");
  lines.push("and probed as divergence cases instead.");
  lines.push("");
  lines.push("Nullable schemas are excluded too, for a different reason worth keeping");
  lines.push("separate from that one. Those are excluded because the specification marks");
  lines.push("them n/a; nullability is excluded because this map is about how a value is");
  lines.push("written, and nullability does not affect that. OpenAPI defers to RFC 6570 for");
  lines.push("which values are undefined, that list includes null, and an undefined variable");
  lines.push("is ignored by the expansion process. A null-valued parameter has no wire form,");
  lines.push("and a non-null one is written the same whether or not null is also admitted.");
  lines.push("Enumerating nullable variants added 41 cells whose cases would have duplicated");
  lines.push("41 existing wire forms exactly. It is probed on its own axis instead, under");
  lines.push("case ids carrying `nullable`.");
  lines.push("");
  lines.push("| location | style | explode | schema | covered |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const cell of surface) {
    lines.push(
      `| ${cell.location} | ${cell.style} | ${String(cell.explode)} | ${cell.schema} | ` +
        `${covered.has(cellKey(cell)) ? "yes" : ""} |`,
    );
  }
  lines.push("");
  lines.push("## Declared value types");
  lines.push("");
  lines.push("The table above is about how a value is written, and the type a schema declares");
  lines.push("for it does not change that. So the types get an axis of their own instead of a");
  lines.push("fifth column, the same treatment nullability gets and for the same reason.");
  lines.push("");
  lines.push("Enumerated from the specification: the JSON Schema data model recognises");
  lines.push("strings, numbers, booleans and null, and `integer` is a convenience defined");
  lines.push("mathematically over numbers. `object` and `array` are containers and the");
  lines.push("`schema` column above already enumerates them.");
  lines.push("");
  lines.push("`wrong value probed` is the column that matters. Declaring a type only shows a");
  lines.push("library the shape it should accept, and it is a value of the wrong type that");
  lines.push("shows whether the type was checked at all.");
  lines.push("");
  lines.push("| type | cases declaring it | wrong value probed |");
  lines.push("| --- | --- | --- |");
  for (const entry of coverage(cases).byType) {
    lines.push(
      `| \`${entry.type}\` | ${String(entry.declaredBy.length)} | ` +
        `${entry.wrongValueBy.length === 0 ? "" : listCases(entry.wrongValueBy)} |`,
    );
  }
  lines.push("");
  lines.push("A wrong-typed value against `string` cannot be constructed here. Every value on");
  lines.push("the wire is text, so there is nothing to send that a string schema must refuse,");
  lines.push("and that cell is empty by definition rather than by omission. Every other empty");
  lines.push("cell is a case nobody has written.");
  lines.push("");
  lines.push("## Content representation surface");
  lines.push("");
  lines.push("The table above enumerates style serialization, and a parameter declaring");
  lines.push("`content` has no style and no explode to place in it. Those cases were in the");
  lines.push("corpus and in no coverage map. This is their map.");
  lines.push("");
  const contentCases = cases.filter((testCase) => testCase.dimensions.declaration === "content");
  const excludedContent = contentCases
    .filter((testCase) => testCase.breaksDocumentRule !== undefined)
    .map((testCase) => testCase.id);

  // The same placement the coverage numbers are counted from, so this table and
  // those numbers cannot describe different surfaces.
  const {
    defined: contentSurface,
    covered: contentCovered,
    offSurface,
  } = placeContentCases(cases, version);
  const contentFilled = contentSurface.filter((cell) => contentCovered.has(contentCellKey(cell)));
  lines.push(
    `Defined combinations: ${String(contentSurface.length)}. ` +
      `Covered: ${String(contentFilled.length)}. ` +
      `Empty: ${String(contentSurface.length - contentFilled.length)}.`,
  );
  lines.push("");
  lines.push(
    `Mostly empty, and published that way. The corpus has ${String(contentCases.length)} ` +
      "content cases and this",
  );
  lines.push("surface has room for far more, so this table keeps the empty cells visible.");
  lines.push("Filling it to look full would make the coverage number less informative.");
  lines.push("");
  lines.push("Almost no legality filter applies, unlike the style table. The Style Values");
  lines.push("table marks some style, location and type combinations n/a; `content` has no");
  lines.push("such table, is permitted in every location this version defines, and is not");
  lines.push("restricted by schema shape or media type. So every empty cell here is a case");
  lines.push("nobody has written, and none of them is a combination the specification");
  lines.push("excludes.");
  lines.push("");
  lines.push("The one filter is which locations the version defines. `querystring` is defined");
  lines.push("by 3.2 and by no earlier version, so it has rows in the 3.2 table alone. A");
  lines.push("querystring row in a 3.0 or 3.1 table would be a cell nobody can fill rather");
  lines.push("than one nobody has filled, and the two must not be counted alike.");
  lines.push("");
  lines.push("`condition` is the axis a style surface has no room for. A media type");
  lines.push("representation can be a value that is not a representation of it, and what a");
  lines.push("library does with that is a different question from what it does with a");
  lines.push("well-formed one. A case carrying `foreignWireShape` fills a `malformed` cell.");
  lines.push("");
  lines.push(
    `Media types enumerated: ${CONTENT_MEDIA_TYPES.map((type) => `\`${type}\``).join(", ")}.`,
  );
  lines.push("That is what the corpus declares. A library's handling of `application/xml` or");
  lines.push("`text/plain` is unmeasured here rather than absent, and widening the axis means");
  lines.push("writing cases that send them.");
  lines.push("");
  lines.push("| location | media type | schema | condition | covered |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const cell of contentSurface) {
    lines.push(
      `| ${cell.location} | ${cell.mediaType} | ${cell.schema} | ${cell.condition} | ` +
        `${contentCovered.has(contentCellKey(cell)) ? "yes" : ""} |`,
    );
  }
  lines.push("");
  lines.push("A case that breaks a rule addressed to whoever wrote the document fills no cell");
  lines.push(
    `here, and ${String(excludedContent.length)} content ` +
      `case${excludedContent.length === 1 ? "" : "s"} ` +
      `${excludedContent.length === 1 ? "is" : "are"} excluded on that rule: ` +
      `${listCases(excludedContent)}. They vary the`,
  );
  lines.push("declaration rather than the representation, so counting them would mark a");
  lines.push(`representation covered that nothing has sent. They appear in \`${matrixFileName(version)}\`.`);
  lines.push("");
  lines.push(
    offSurface.length === 0
      ? "Every remaining content case lands in a cell above."
      : `Content cases landing outside these axes, and therefore counted nowhere: ` +
        `${listCases(offSurface)}. Widening an axis is what would place them.`,
  );
  lines.push("");

  lines.push("## Specification sections exercised");
  lines.push("");
  lines.push("Case ids name the surface under probe, such as location, style, schema shape");
  lines.push("and what the case varies. They do not name the specification section, which");
  lines.push("lives in the citation. This index reads the other way, from section to cases,");
  lines.push("so a reader starting at a paragraph of the specification can find every case");
  lines.push("resting on it, and can see which cited sections carry only one.");
  lines.push("");
  lines.push("| section | cases |");
  lines.push("| --- | --- |");
  const byAnchor = new Map<string, string[]>();
  for (const testCase of cases) {
    const cited =
      testCase.tier === "conformance"
        ? testCase.citations
        : testCase.basis === null
          ? []
          : [testCase.basis];
    for (const citation of cited) {
      const existing = byAnchor.get(citation.anchor) ?? [];
      existing.push(testCase.id);
      byAnchor.set(citation.anchor, existing);
    }
  }
  for (const anchor of [...byAnchor.keys()].sort()) {
    const ids = (byAnchor.get(anchor) ?? []).map((id) => `\`${id}\``).join(", ");
    lines.push(`| ${anchor} | ${ids} |`);
  }
  lines.push("");
  const silent = cases.filter((c) => c.tier === "divergence" && c.basis === null).map((c) => c.id);
  lines.push(
    `Cases resting on no cited section, because the specification is silent: ` +
      `${silent.length === 0 ? "none" : silent.map((id) => `\`${id}\``).join(", ")}.`,
  );
  lines.push("");
  lines.push("## Default resolution");
  lines.push("");
  lines.push("Whether a case writes style and explode out or leaves them to the default.");
  lines.push("Leaving them out puts the library's default resolution under test before any");
  lines.push("deserialization happens, so it is a different code path rather than a");
  lines.push("different value. A corpus written by hand reaches for the declared form, so");
  lines.push("this axis is the one most likely to be quietly empty.");
  lines.push("");
  lines.push("The defaulted path is reported to be far more common in published documents");
  lines.push("than any declared style. That report is not this repository's measurement:");
  lines.push("see Figures from elsewhere, below.");
  lines.push("");
  lines.push("| location | style declared | explode declared | cases |");
  lines.push("| --- | --- | --- | --- |");
  // Only the locations that can carry a style. A querystring parameter is
  // declared with `content`, and the specification says `style` and `explode`
  // MUST NOT be used with it, so a row for it could only ever read `0 of 0`.
  // An empty cell on this surface means a case nobody has written, and a row
  // that no case can ever fill says something else in the same shape.
  for (const location of LOCATIONS.filter((candidate) => candidate !== "querystring")) {
    for (const declared of [true, false]) {
      const matching = cases.filter(
        (c) =>
          c.dimensions.location === location &&
          c.dimensions.declaration === "schema" && (c.dimensions.declaredStyle !== "unset") === declared,
      );
      const explodeDeclared = matching.filter(
        (c) => c.dimensions.declaration === "schema" && c.dimensions.declaredExplode !== "unset",
      );
      lines.push(
        `| ${location} | ${declared ? "yes" : "no"} | ${String(explodeDeclared.length)} of ` +
          `${String(matching.length)} | ${String(matching.length)} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Figures from elsewhere");
  lines.push("");
  lines.push(
    "Every other number in this report traces to stored raw output in " +
      "`report/libraries/<slug>.json`.",
  );
  lines.push("The figures below do not, because this repository did not measure them. They");
  lines.push("are recorded here, attributed, and kept off the measurement tables, where they");
  lines.push("would read as though they had been.");
  lines.push("");
  for (const figure of externalFigures) {
    lines.push(`### ${figure.id}`);
    lines.push("");
    lines.push(figure.claim);
    lines.push("");
    for (const value of figure.figures) lines.push(`- ${value}`);
    lines.push("");
    lines.push(
      `Reported by ${figure.reportedBy} on ${figure.date}, from the ${figure.source}. ` +
        `**Not reproduced by this repository.**`,
    );
    lines.push("");
    lines.push(`To reproduce it: ${figure.toReproduce}.`);
    lines.push("");
  }
  lines.push("## Probe axes");
  lines.push("");
  lines.push("The serialization surface is one dimension. The other is what each case varies");
  lines.push("away from canonical, and an axis with no cases is a blind spot the table above");
  lines.push("cannot show.");
  lines.push("");
  lines.push("| probe axis | cases |");
  lines.push("| --- | --- |");
  for (const axis of PROBE_AXES) {
    const count = cases.filter((c) => c.dimensions.probeAxis === axis).length;
    lines.push(`| ${axis} | ${String(count)} |`);
  }
  lines.push("");

  lines.push("## Cases by the stage they probe");
  lines.push("");
  lines.push("Which stage of the request-validation pipeline each case exists to probe,");
  lines.push("derived from the axis it varies and the location it varies it in.");
  lines.push("");
  lines.push("A coverage map in its own right, and a blunter one than the surface table. A");
  lines.push("corpus concentrated on one stage is blind to the rest however many cases it");
  lines.push("holds, because the stages it does not probe are the ones it holds constant.");
  lines.push("Filling the surface table does not fix that on its own: every empty cell there");
  lines.push("would be filled by a canonical case, and canonical probes style.");
  lines.push("");
  lines.push("| probed stage | conformance | divergence |");
  lines.push("| --- | --- | --- |");
  for (const stage of PIPELINE_STAGES) {
    if (stage === "valueExposure") continue;
    const probing = cases.filter((testCase) => probesStage(testCase, stage, null));
    const settled = probing.filter((testCase) => testCase.tier === "conformance").length;
    lines.push(`| ${stage} | ${String(settled)} | ${String(probing.length - settled)} |`);
  }
  lines.push("");
  lines.push("`valueExposure` is a pipeline stage and has no row here, which is deliberate and");
  lines.push("is a correction. It had one, reading `0` and `0`, and that read as a gap someone");
  lines.push("could fill by writing cases. No case can fill it. A case probes a stage by");
  lines.push("varying something and seeing whether the verdict moves, and exposure changes no");
  lines.push("verdict: a library hands back the values it parsed or it does not, whatever the");
  lines.push("request was. Removing the row keeps the table from advertising work that would");
  lines.push("not change the coverage.");
  lines.push("");
  lines.push("Exposure is asked of every case that carries expected values, as the second half");
  lines.push("of that case, and it is reported per library in `capabilities.md` under what each");
  lines.push("library exposed and from what vantage. That is where its coverage lives.");
  lines.push("");

  lines.push("## Held constant across every case");
  lines.push("");
  lines.push("A constant is a blind spot, so the deliberate ones are published here rather");
  lines.push("than left invisible. Each is a decision a future case can overturn, and one");
  lines.push("already was: every declaration was required until the optional-absent axis");
  lines.push("existed.");
  lines.push("");
  const methods = [...new Set(cases.map((c) => c.request.method))].sort();
  lines.push(`- Request method: ${methods.join(", ")} only. Method matching is routing`);
  lines.push("  surface nothing here varies.");
  lines.push("- No request bodies. Parameters are the subject, and a body brings a second");
  lines.push("  deserialization pipeline whose failures a case could not tell apart from");
  lines.push("  the first's.");
  lines.push("- One operation per path and one declared parameter, except where a case");
  lines.push("  names the competition it stages.");
  lines.push("");
  return lines.join("\n");
}

/**
 * What each library does for itself, and what you would be writing yourself.
 *
 * A separate artifact from the matrix because it answers a separate question.
 * The matrix asks whether a library reads the specification correctly when fed
 * at the boundary it accepts. This asks whether it can be handed an HTTP request
 * and produce a verdict, which is about coverage rather than
 * correctness. Every delegated stage is a stage its caller implements, and the
 * bugs there belong to the caller.
 *
 * Nothing here is scored, ranked or totalled. A library owning fewer stages has
 * a different shape, and a caller who already has a framework doing the
 * splitting may want exactly that shape.
 */
/**
 * The way into a run directory, for someone who has not read anything else.
 *
 * Every other file here opens in the middle of its own argument, which is right
 * for the file and unhelpful for a reader who has just arrived and does not yet know
 * what a case is, what an adapter is, or why a library can be missing from a row
 * without a library failure. The page renders that orientation too, and the
 * page is not committed, so a directory browsed on a forge had nothing.
 *
 * Named README.md because that is the file a directory listing shows first,
 * which is the whole job.
 */
function renderReadme(
  cases: readonly Case[],
  measurements: readonly LibraryMeasurement[],
  view: CoverageView,
): string {
  const lines: string[] = [];
  const libraries = measurements.length;

  lines.push("# What is in this directory");
  lines.push("");
  lines.push(
    `${String(libraries)} request-validation librar${libraries === 1 ? "y was" : "ies were"} ` +
      `handed the same OpenAPI documents and the same HTTP requests, and this directory ` +
      `holds what ${libraries === 1 ? "it" : "each of them"} answered.`,
  );
  lines.push("");
  lines.push("Generated by `pnpm render-md`. Nothing here is written by hand.");
  lines.push("");

  lines.push("## The words these files use");
  lines.push("");
  lines.push("| term | what it means |");
  lines.push("| --- | --- |");
  lines.push(
    "| case | One document, one request, and one question about how the specification " +
      `says that request should be read. There are ${String(view.conformance + view.divergence)}, ` +
      "and the whole set is the corpus. |",
  );
  lines.push(
    "| library | A request validator someone published. Nothing here compares them on " +
      "speed, size, or anything but what they answered. |",
  );
  lines.push(
    "| adapter | How one library gets asked. Each runs in a container of its own with a " +
      "small program speaking this harness's protocol on one side and that library's own " +
      "API on the other, so nothing above that layer knows which library is running. |",
  );
  lines.push(
    "| measurement | One library's answers to the whole corpus, in " +
      "`libraries/<name>.json`, readable without any of the others. |",
  );
  lines.push(
    "| stage | A step of the work: matching the route, splitting the query string, " +
      "applying a style, checking the schema. A library performs some and expects its " +
      "caller to have done the rest, and a case is only put to a library that performs " +
      "the step that case is about. That is why a cell can read `n/a` without implying " +
      "a failure. |",
  );
  lines.push("");

  lines.push("## The two kinds of case");
  lines.push("");
  lines.push(
    `**Conformance**, ${String(view.conformance)} cases. The specification settles these, ` +
      "so there is one required answer and a different answer is a failure attributable " +
      "to the library. Every one quotes the text that settles it.",
  );
  lines.push("");
  lines.push(
    `**Divergence**, ${String(view.divergence)} cases. The specification leaves these ` +
      "open, so libraries may differ and none of them is failing. They are reported and " +
      "never scored, because scoring them would be this project inventing a rule the " +
      "specification declined to write.",
  );
  lines.push("");

  lines.push("## What to read, in order");
  lines.push("");
  lines.push("| file | what it answers |");
  lines.push("| --- | --- |");
  for (const version of presentVersions(cases)) {
    const file = matrixFileName(version);
    lines.push(
      `| [${file}](${file}) | Every OpenAPI ${version} case against every library, conformance first. |`,
    );
  }
  lines.push(
    "| [fitness.md](fitness.md) | How much of the pipeline each library does for itself, and so how " +
      "much you would write yourself. |",
  );
  lines.push(
    "| [capabilities.md](capabilities.md) | What each library can be asked, and what the probes of those " +
      "claims saw. |",
  );
  for (const version of presentVersions(cases)) {
    const file = `coverage.${versionSlug(version)}.md`;
    lines.push(
      `| [${file}](${file}) | What the corpus asks of OpenAPI ${version} and what it does not, ` +
        "enumerated from the specification so an empty cell is a case nobody has written. |",
    );
  }
  lines.push("| `libraries/<name>.md` | One library on its own, with its counts. |");
  lines.push("");
  lines.push(
    "The measurement itself is the JSON. `corpus.json` holds the questions and " +
      "`libraries/<name>.json` holds one library's raw answers, each with what that " +
      "library actually returned. The markdown is a reading of those, so anyone wanting a " +
      "different presentation has the measurement without needing this one.",
  );
  lines.push("");
  lines.push(
    "A cell that appears inaccurate is disputed from that JSON, starting at the `raw` value " +
      "stored with the answer. The harness repository's `docs/adding-an-adapter.md` " +
      "says how, and what counts as a fix.",
  );
  lines.push("");
  lines.push(
    "`pnpm render-html <this directory>` writes `index.html`, the same results as a page.",
  );
  lines.push("");

  lines.push("## What this directory does not say");
  lines.push("");
  lines.push(
    "Nothing is totalled across libraries. They are asked different numbers of cases, so " +
      "each library's counts have a denominator of its own, and a column of them would " +
      "rank libraries against denominators they do not share.",
  );
  lines.push("");
  lines.push(
    "`run.json` records when this run happened and what produced it. It names no " +
      "measurement and no measurement names it, so it dates the directory rather than the " +
      "answers in it. Whether the answers still match what the libraries do today is " +
      "settled only by running the containers again.",
  );
  lines.push("");

  lines.push(
    "Every measurement carries a digest of the corpus it answered, and two measurements " +
      "sharing one were asked the same questions, which is the precondition for comparing " +
      "them. The digest covers every field of every case, so a case that was reworded " +
      "moves it as surely as one that was rewritten, and two runs either side of a typo " +
      "fix no longer compare. It is written when a run is measured and never rechecked, " +
      "so it names the corpus the harness held at the time rather than proving the " +
      "`corpus.json` here is still that one.",
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderFitness(cases: readonly Case[], measurements: readonly LibraryMeasurement[]): string {
  const lines: string[] = [];
  lines.push("# Fitness as a request validator");
  lines.push("");
  lines.push("Generated by `pnpm render-md`. What each library does for itself, stage by");
  lines.push("stage of the request-validation pipeline, and therefore what a caller supplies.");
  lines.push("");
  lines.push("This is a different question from the matrix files. Those ask whether a library");
  lines.push("reads the specification correctly when it is fed at the boundary it accepts.");
  lines.push("This one asks how much of the pipeline you would be writing yourself. Nothing");
  lines.push("here is scored or ranked: a library owning fewer stages has a different shape,");
  lines.push("and a caller whose framework already splits the request may want that shape.");
  lines.push("");
  lines.push("`owned` means the library does it. `caller` means the library requires it to");
  lines.push("have been done already, so the specification rules governing that stage are");
  lines.push("the caller's to get right, and the second half of this report names them.");
  lines.push("");
  lines.push("A citation listed under a stage is a rule some case probing that stage rests");
  lines.push("on. A case's verdict can rest on rules governing a neighbouring stage too, so");
  lines.push("read the list as what the corpus knows about that stage rather than as the");
  lines.push("exact set of rules governing it and nothing else.");
  lines.push("");
  lines.push(
    "| library | routing | split: path | split: query | split: header | split: cookie | " +
      "style and explode | content media type | schema validation | value exposure |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const adapter of measurements) {
    const s = adapter.capabilities.stages;
    lines.push(
      `| \`${adapter.library}\` | ${owned(s.routing)} | ${owned(s.splitting.path)} | ` +
        `${owned(s.splitting.query)} | ${owned(s.splitting.header)} | ${owned(s.splitting.cookie)} | ` +
        `${owned(s.styleDeserialization)} | ${owned(s.contentDeserialization)} | ` +
        `${owned(s.schemaValidation)} | ${owned(s.valueExposure)} |`,
    );
  }
  lines.push("");
  lines.push("`style and explode` and `content media type` are the two ways a parameter's");
  lines.push("serialization can be specified, and the specification requires each parameter to");
  lines.push("use one. They are separate columns because a library can do one and not the");
  lines.push("other, and one column covering both cannot say so.");
  lines.push("");
  lines.push("A library is asked a case only when it owns the stage that case probes and");
  lines.push("every stage between that one and the verdict. Stages upstream of the probe can");
  lines.push("be filled in by the harness, identically for everyone and recorded on the cell.");
  lines.push("Stages downstream cannot: those produce the verdict, and a harness that");
  lines.push("deserialized a style or validated a schema on a library's behalf would be");
  lines.push("grading its own work.");
  lines.push("");
  lines.push("## What each library leaves to its caller");
  lines.push("");
  for (const adapter of measurements) {
    lines.push(`### \`${adapter.library}\``);
    lines.push("");
    const delegated = delegatedStages(adapter);
    if (delegated.length === 0) {
      lines.push("Nothing. Hand it a request and it answers.");
      lines.push("");
      continue;
    }
    lines.push("Supply these yourself before it can answer. Under each is what the corpus");
    lines.push("already knows about that stage: the cases probing it, and the rules their");
    lines.push("expected verdicts rest on.");
    lines.push("");
    for (const item of delegated) {
      lines.push(`**${item.title}.** ${item.detail}`);
      lines.push("");
      const behind = rulesBehind(cases, item.stage, item.location);
      if (behind.settled.length === 0 && behind.unsettled.length === 0) {
        lines.push("No case in this corpus probes that stage yet, so the corpus has nothing to");
        lines.push("hand you here. That is a gap in the corpus rather than a sign the stage is");
        lines.push("simple.");
        lines.push("");
        continue;
      }
      if (behind.settled.length > 0) {
        lines.push(
          `${String(behind.settled.length)} conformance case${behind.settled.length === 1 ? "" : "s"} ` +
            `probe${behind.settled.length === 1 ? "s" : ""} it: ${listCases(behind.settled)}.`,
        );
        lines.push("");
        lines.push("Rules those verdicts rest on:");
        lines.push("");
        for (const citation of behind.citations) {
          lines.push(`- [${citation.anchor}](${citation.url})`);
        }
        lines.push("");
      }
      if (behind.unsettled.length > 0) {
        lines.push(
          `${String(behind.unsettled.length)} divergence case${behind.unsettled.length === 1 ? "" : "s"} ` +
            `also probe${behind.unsettled.length === 1 ? "s" : ""} it: ${listCases(behind.unsettled)}. ` +
            "The specification does not settle those, and measured implementations disagree, " +
            "so implementing this stage means choosing a side rather than following a rule.",
        );
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}

function owned(value: boolean): string {
  return value ? "owned" : "caller";
}

/** What a caller has to do for this library, in pipeline order. */
/** One stage a library leaves to its caller, and where in the corpus it bites. */
interface Delegated {
  readonly title: string;
  readonly detail: string;
  readonly stage: PipelineStage;
  /** Set for splitting, which is delegated per location rather than wholesale. */
  readonly location: ParameterLocation | null;
}

function delegatedStages(adapter: LibraryMeasurement): readonly Delegated[] {
  const s = adapter.capabilities.stages;
  const delegated: Delegated[] = [];
  if (!s.routing) {
    delegated.push({
      title: "Routing",
      detail: "Match the request to an operation and tell it which one applies.",
      stage: "routing",
      location: null,
    });
  }
  if (!s.splitting.path) {
    delegated.push({
      title: "Path splitting",
      detail: "Recover each path parameter's raw value from the target.",
      stage: "splitting",
      location: "path",
    });
  }
  if (!s.splitting.header) {
    delegated.push({
      title: "Header name matching",
      detail:
        "Its input is keyed by header name, so fold the casing and collect same-named " +
        "headers yourself before calling it.",
      stage: "splitting",
      location: "header",
    });
  }
  if (!s.splitting.query) {
    delegated.push({
      title: "Query splitting",
      detail: "Split the query string into name and value pairs.",
      stage: "splitting",
      location: "query",
    });
  }
  if (!s.splitting.cookie) {
    delegated.push({
      title: "Cookie splitting",
      detail: "Split the `Cookie` header into name and value pairs.",
      stage: "splitting",
      location: "cookie",
    });
  }
  if (!s.styleDeserialization) {
    delegated.push({
      title: "Style and explode",
      detail:
        "Apply each parameter's `style` and `explode` yourself. It validates the structured " +
        "value you hand it and performs no deserialization of its own.",
      stage: "styleDeserialization",
      location: null,
    });
  }
  if (!s.contentDeserialization) {
    delegated.push({
      title: "Content media type",
      detail:
        "Read a `content` parameter's raw value as a representation of its declared media " +
        "type yourself, and hand it the result. A value that is not a representation of " +
        "that media type reaches it as text.",
      stage: "contentDeserialization",
      location: null,
    });
  }
  if (!s.schemaValidation) {
    delegated.push({
      title: "Schema validation",
      detail: "Validate the values yourself.",
      stage: "schemaValidation",
      location: null,
    });
  }
  if (!s.valueExposure) {
    delegated.push({
      title: "Value exposure",
      detail:
        "It returns a verdict and no values, so a caller needing the deserialized values " +
        "computes them again from the request.",
      stage: "valueExposure",
      location: null,
    });
  }
  return delegated;
}

/**
 * The conformance cases that probe a stage, and the rules their verdicts rest on.
 *
 * Read carefully, and the report says so: these are the citations carried by
 * cases probing this stage, and a case's verdict can rest on rules governing a
 * neighbouring stage as well. Claiming the list is exactly the rules that
 * govern this stage alone would be the same over-reach as a provenance record
 * claiming work the harness never did.
 */
function probesStage(
  testCase: Case,
  stage: PipelineStage,
  location: ParameterLocation | null,
): boolean {
  const dimensions = testCase.dimensions;
  if (probedStage(dimensions) !== stage) return false;
  return location === null || dimensions.location === location;
}

function rulesBehind(
  cases: readonly Case[],
  stage: PipelineStage,
  location: ParameterLocation | null,
): {
  readonly settled: readonly string[];
  readonly unsettled: readonly string[];
  readonly citations: readonly Citation[];
} {
  const matching = cases.filter((testCase) => probesStage(testCase, stage, location));
  const settled = matching.filter((c): c is ConformanceCase => c.tier === "conformance");

  // Keyed by version and anchor, because an anchor names a section of one
  // document and the same section name exists in three. Keyed by anchor alone,
  // the corpus's id order decided which document's URL survived: `schema-object`
  // and `fixed-fields-for-use-with-content` exist in all three, so the 3.1 links
  // were being overwritten by whichever version sorted last, and a reader
  // following a rule behind a 3.0 case landed in the 3.2 document.
  const seen = new Map<string, Citation>();
  for (const testCase of settled) {
    for (const citation of testCase.citations) {
      seen.set(`${citation.oasVersion}|${citation.anchor}`, citation);
    }
  }
  return {
    settled: settled.map((testCase) => testCase.id),
    // Divergence cases carry no rule, and that is the point of naming them
    // here: implementations already disagree about this stage, so a caller
    // implementing it is choosing a side rather than following a rule.
    unsettled: matching.filter((c) => c.tier === "divergence").map((c) => c.id),
    citations: [...seen.values()].sort((a, b) =>
      a.anchor === b.anchor
        ? a.oasVersion < b.oasVersion
          ? -1
          : 1
        : a.anchor < b.anchor
          ? -1
          : 1,
    ),
  };
}

/** At most eight, and say so rather than trailing off. */
function listCases(ids: readonly string[]): string {
  const shown = ids.slice(0, 8).map((id) => `\`${id}\``);
  const remainder = ids.length - shown.length;
  return remainder === 0
    ? shown.join(", ")
    : `${shown.join(", ")}, and ${String(remainder)} more in the matrix files`;
}

/**
 * Every slot a declaration can fill: the stages, with splitting once per
 * location because that is how it is claimed.
 *
 * Enumerated rather than derived from what any library declared, so a stage no
 * library claims still gets a row saying so.
 */
export interface StageSlot {
  readonly stage: PipelineStage;
  readonly location: SplittableLocation | null;
}

export const STAGE_SLOTS: readonly StageSlot[] = PIPELINE_STAGES.flatMap((stage): StageSlot[] =>
  stage === "splitting"
    ? SPLITTABLE_LOCATIONS.map((location) => ({ stage, location }))
    : [{ stage, location: null }],
);

function renderCapabilities(
  cases: readonly Case[],
  measurements: readonly LibraryMeasurement[],
): string {
  const lines: string[] = [];
  lines.push("# Capabilities");
  lines.push("");
  lines.push("What each library can be asked, which is a different question from what it");
  lines.push("answers. Every entry here is a declaration its adapter made, and every one was");
  lines.push("probed in this run: the tables below publish what each probe saw, including");
  lines.push("where a declaration is unbacked and where a disclaimed stage was exercised");
  lines.push("anyway. The vantage column is read back from results rather than declared at");
  lines.push("all.");
  lines.push("");
  lines.push("The probes do not prove every declaration, and the section below says which");
  lines.push("ones they can settle and which they cannot.");
  lines.push("");
  lines.push("| library | accepts a request target | value vantages observed | owns routing |");
  lines.push("| --- | --- | --- | --- |");
  for (const adapter of measurements) {
    const c = adapter.capabilities;
    lines.push(
      `| \`${adapter.library}\` | ${yesNo(splitsWholeTarget(c))} | ` +
        `${observedVantages(measurements, adapter.library)} | ${yesNo(c.stages.routing)} |`,
    );
  }
  lines.push("");
  lines.push("Every value cell says from what point in the library's own processing the");
  lines.push("values were read, because an absent parameter name does not mean the same");
  lines.push("thing across the roster:");
  lines.push("");
  lines.push("- `handed to the handler`: what the application was given. A name is absent");
  lines.push("  when the handler never ran.");
  lines.push("- `parsed before validation`: what the library parsed, reported whether or not");
  lines.push("  it then rejected. On a rejection these can be partial.");
  lines.push("- `validated only, so an absent name failed its schema`: only the parameters");
  lines.push("  that passed. An empty cell here is a withheld value, not an empty parse.");
  lines.push("");
  lines.push("Comparing a value across two libraries means comparing the vantages too. A");
  lines.push("library reporting a coerced value alongside its own rejection and a library");
  lines.push("withholding it are stating different facts, and neither is a failure.");
  lines.push("");
  lines.push("A library that does not accept a request target is never asked a");
  lines.push("wire-deserialization question. The harness would have to split the target for");
  lines.push("it, and the verdict would then describe the harness's splitting rather than the");
  lines.push("library. Those cells read `not asked (noWireInputApi)`.");
  lines.push("");
  lines.push("## Value exposure, case by case");
  lines.push("");
  lines.push("What each library handed back across the whole corpus, with the denominator.");
  lines.push("A library with no exposure API and a library that exposed nothing here are");
  lines.push("different facts, and a column of blanks renders them the same.");
  lines.push("");
  lines.push("`reached a verdict` is the denominator: cases where the library decided, so");
  lines.push("there was a point at which values could have been reported. `observed`,");
  lines.push("`unexposed` and `not reached` partition it. `never asked` and `raised` sit");
  lines.push("outside it, because a case the library was never given and a case it threw on");
  lines.push("never reached that point at all.");
  lines.push("");
  lines.push(
    "`observed` counts an answer that named a parameter this container could not read, and",
  );
  lines.push("`of those, one withheld` says how many. A parameter with no slot in a");
  lines.push("container's request shape was never put to the library, so counting it as a");
  lines.push("value the library declined to report would attribute the container's reach to");
  lines.push("it.");
  lines.push("");
  lines.push(
    `| library | reached a verdict | observed | of those, one withheld | unexposed | not reached | never asked | raised |`,
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const adapter of measurements) {
    const tally = exposureTally(adapter);
    lines.push(
      `| \`${adapter.library}\` | ${String(tally.decided)} | ${String(tally.observed)} | ` +
        `${String(tally.partlyObserved)} | ${String(tally.unexposed)} | ` +
        `${String(tally.notReached)} | ${String(tally.neverAsked)} | ${String(tally.raised)} |`,
    );
  }
  lines.push("");
  lines.push("Split by the verdict the values were reported alongside, because a library that");
  lines.push("exposes what it parsed even for a request it rejected is stating something a");
  lines.push("library that withholds on rejection is not. Both are legitimate and neither is");
  lines.push("a failure.");
  lines.push("");
  lines.push(
    "| library | verdict | observed | of those, one withheld | unexposed | not reached | vantages |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const adapter of measurements) {
    for (const verdict of ["accepted", "rejected"] as const) {
      const tally = exposureTally(adapter, verdict);
      lines.push(
        `| \`${adapter.library}\` | ${verdict} | ${String(tally.observed)} | ` +
          `${String(tally.partlyObserved)} | ${String(tally.unexposed)} | ` +
          `${String(tally.notReached)} | ${tally.vantages} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Values written back onto the caller's input");
  lines.push("");
  lines.push("A published call is one way a library hands values back. Writing them onto the");
  lines.push("request object its caller passed is another, and a caller reading that object");
  lines.push("afterwards is reading a real value channel. Nothing in the table above can see");
  lines.push("it, so each container compares what it handed over against what came back and");
  lines.push("reports the answer with every case.");
  lines.push("");
  lines.push("`wrote back` is the finding. `unchanged` is the container having compared and");
  lines.push("found nothing, which is a fact about the library. `not compared` is the");
  lines.push("container unable to look, which is a fact about the container: it is a gap in");
  lines.push("the measurement rather than a clean result, and it is published as one.");
  lines.push("");
  lines.push("A library that writes back while declaring no value exposure is contradicting");
  lines.push("itself, and the gate fails on that. A library that writes back and declares");
  lines.push("exposure is doing two things at once, which is worth knowing and is not a");
  lines.push("failure.");
  lines.push("");
  lines.push("| library | declares exposure | wrote back | unchanged | not compared |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const measurement of measurements) {
    const decided = measurement.answers
      .map((answer) => answer.result)
      .filter((result) => result.outcome === "accepted" || result.outcome === "rejected");
    const counted = (kind: string): number =>
      decided.filter((result) => result.inputMutation.kind === kind).length;
    lines.push(
      `| \`${measurement.library}\` | ` +
        `${measurement.capabilities.stages.valueExposure ? "yes" : "no"} | ` +
        `${String(counted("observed"))} | ${String(counted("none"))} | ` +
        `${String(counted("notCompared"))} |`,
    );
  }
  lines.push("");
  lines.push("What was compared, and what changed where something did, is on every answer in");
  lines.push("`libraries/<name>.json` under `inputMutation`. A count here with no scope");
  lines.push("beside it would be a number nobody could weigh.");
  lines.push("");

  lines.push("## What the declarations were probed with");
  lines.push("");
  lines.push("Every stage above is declared by an adapter, and every declaration is probed.");
  lines.push("Each probe is two-sided: one input a library owning that stage accepts and one it");
  lines.push("rejects, differing only in the dimension that stage governs. A library that");
  lines.push("ignores what it does not understand accepts both, so accepting the valid side");
  lines.push("alone shows nothing; the pair is what carries the evidence.");
  lines.push("");
  lines.push("The probes are the harness checking its own inputs. They carry no citation and");
  lines.push("no tier, they answer no question about the specification, and they are not in");
  lines.push("`corpus.json`. Both sides of every one are stored with the library's own output");
  lines.push("in `libraries/<slug>.json` under `capabilityEvidence`.");
  lines.push("");
  lines.push("A splitting claim is evidenced only by the variant that withholds the location");
  lines.push("under probe while supplying every other location as usual. Run on the input a");
  lines.push("library normally receives, a splitting probe would be measuring the harness.");
  lines.push("The `asDeclared` variant is the control: it shows both sides are answerable at");
  lines.push("the boundary the library accepts, so a failure in the other variant reads as");
  lines.push("`did not recover that location` rather than `could not answer this at all`.");
  lines.push("");
  lines.push("A probe demonstrates ownership and almost never refutes it, and the gate is");
  lines.push("built on that asymmetry. Ownership is who does the work: a library owns a");
  lines.push("deserialization stage when it converts the raw value itself rather than");
  lines.push("requiring its caller to. Whether it converts it correctly is the question");
  lines.push("the matrix files ask. A library that reads a comma-joined array as JSON fails");
  lines.push("every style probe here while plainly doing the conversion itself, so a probe");
  lines.push("that showed nothing cannot be read as the stage being absent.");
  lines.push("");
  lines.push("So a declared stage no probe showed is published as an unbacked claim, with the");
  lines.push("probes that showed nothing named, and it does not fail the gate. Reading absent");
  lines.push("evidence as absent capability would let any library move its attributable");
  lines.push("failures into `not asked` by disclaiming the stage.");
  lines.push("");
  lines.push("Three contradictions can be built, and those do fail the gate. A splitting");
  lines.push("claim is contradicted when the library answers with the location supplied and");
  lines.push("not without it, because supplying a split is upstream work the harness may do");
  lines.push("and the counterfactual is therefore constructible. An exposure claim is");
  lines.push("contradicted by `unexposed` in the same result. A disclaimed exposure is");
  lines.push("contradicted by a write-back in the section above, which is two fields of one");
  lines.push("answer disagreeing. Every other stage would need the harness to deserialize on");
  lines.push("the library's behalf to build the counterfactual, which it must never do.");
  lines.push("");
  lines.push("A stage a library disclaims that a probe exercised anyway is printed for a");
  lines.push("reader to judge rather than treated as a correction.");
  lines.push("");
  lines.push("### What stands behind each declared stage");
  lines.push("");
  lines.push("A declaration rests on the probes of that stage, and on nothing else. Letting a");
  lines.push("conformance pass stand in for a probe was considered and dropped: the only pass");
  lines.push("that would evidence a stage is one whose expected values matched, a library that");
  lines.push("exposes no values can never produce one whatever it does, and no declaration in");
  lines.push("this roster rested on it. It decided nothing while tying a capability claim to a");
  lines.push("conformance score.");
  lines.push("");
  lines.push("Probes that did not show a stage stay in the row beside whatever did. A stage");
  lines.push("demonstrated by one probe while another probe of it showed nothing is partial");
  lines.push("support, and printing only the support would turn that into a checkbox.");
  lines.push("");
  lines.push("| library | stage | declared | shown by | probes that did not show it |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const adapter of measurements) {
    for (const { stage, location } of STAGE_SLOTS) {
      const reading = stageReading(adapter.capabilityEvidence, stage, location);
      const name = location === null ? stage : `${stage}: ${location}`;
      const declared = ownsStage(adapter.capabilities.stages, stage, location ?? "path");
      const rests =
        reading.demonstratedBy.length > 0
          ? listCases(reading.demonstratedBy)
          : declared
            ? "nothing this run could show, so the claim is unbacked here"
            : "nothing, which is what a disclaim predicts";
      const unshown =
        reading.notShownBy.length === 0
          ? "none"
          : `${listCases(reading.notShownBy)}${declared ? "" : " (consistent with the disclaim)"}`;
      lines.push(
        `| \`${adapter.library}\` | ${name} | ${owned(declared)} | ${rests} | ${unshown} |`,
      );
    }
  }
  lines.push("");
  for (const adapter of measurements) {
    lines.push(`### \`${adapter.library}\``);
    lines.push("");
    lines.push("| probe | asks | declared | accepted side | rejected side | reading |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const entry of adapter.capabilityEvidence) {
      lines.push(
        `| \`${entry.probeId}\` | ${entry.asks} | ${entry.declared ? "owned" : "caller"} | ` +
          `${sideOf(entry.accepted)} | ${sideOf(entry.rejected)} | ${readingOf(entry)} |`,
      );
    }
    lines.push("");
    const contradicted = adapter.capabilityEvidence.filter(
      (entry) => !entry.declared && demonstrates(entry),
    );
    if (contradicted.length > 0) {
      lines.push("Disclaimed, and exercised anyway by these probes: " + listCases(contradicted.map((e) => e.probeId)) + ".");
      lines.push("Cases probing those stages are withheld from this library as `stageNotOwned`,");
      lines.push("and the rows above are what happened when the stage was probed regardless.");
      lines.push("");
    }
  }

  lines.push("## Specification versions");
  lines.push("");
  lines.push("Which OpenAPI versions each container declares its library accepts documents");
  lines.push("of. A declaration names a minor line: 3.1 means 3.1.x documents, and the");
  lines.push("citations pin exact patch revisions where exactness matters. The runner asks a");
  lines.push("library only the cases whose version it declares; the rest render as `n/a`");
  lines.push("with `oasVersionNotDeclared` as the reason.");
  lines.push("");
  lines.push("Every version the protocol knows is probed, declared or not, with an ordinary");
  lines.push("document of that version: a valid request on one side and a value outside the");
  lines.push("schema's enumeration on the other. Like every probe, this demonstrates and");
  lines.push("never refutes: a library can reject the valid side out of strictness about");
  lines.push("something else entirely, so a declared version no probe showed is published as");
  lines.push("an unbacked claim rather than treated as false.");
  lines.push("");
  lines.push("| library | version | declared | accepted side | rejected side | reading |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const adapter of measurements) {
    for (const entry of adapter.versionEvidence) {
      const how = versionDemonstratedBy(entry);
      const shown =
        how === "byRaise"
          ? "exercised, and raised on the invalid side rather than returning a verdict"
          : "demonstrated by the pair of verdicts";
      const reading = entry.declared
        ? how === null
          ? "declared, and this probe did not show it"
          : shown
        : how === null
          ? "disclaimed, and not shown"
          : `disclaimed, and ${shown}`;
      lines.push(
        `| \`${adapter.library}\` | ${entry.oasVersion} | ${yesNo(entry.declared)} | ` +
          `${sideOf(entry.accepted)} | ${sideOf(entry.rejected)} | ${reading} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Configuration");
  lines.push("");
  for (const adapter of measurements) {
    lines.push(`### \`${adapter.library}\``);
    lines.push("");
    lines.push(`\`${adapter.configuration.id}\`: ${adapter.configuration.description}`);
    lines.push("");
  }
  return lines.join("\n");
}

interface ExposureTally {
  /** Cases where the library reached a verdict, so values could have been reported. */
  readonly decided: number;
  readonly observed: number;
  /**
   * Of those observed, the ones where a declared parameter had no slot in this
   * container's request shape and was reported unreadable.
   *
   * Counted apart because the row exists to keep a library with no exposure API
   * and a library that exposed nothing here from reading alike, and an answer
   * carrying an unreadable parameter is a third thing again: the library
   * exposed what it was asked for, and one parameter was never put to it.
   */
  readonly partlyObserved: number;
  readonly unexposed: number;
  readonly notReached: number;
  readonly neverAsked: number;
  readonly raised: number;
  readonly vantages: string;
}

/**
 * What one library exposed across the corpus, optionally for one verdict.
 *
 * Counted from stored answers rather than from a declaration, so a library
 * whose adapter claims exposure and reports none is visible as the mismatch it
 * is rather than as a green column.
 */
function exposureTally(
  measurement: LibraryMeasurement,
  verdict?: "accepted" | "rejected",
): ExposureTally {
  let decided = 0;
  let observed = 0;
  let unexposed = 0;
  let notReached = 0;
  let partlyObserved = 0;
  let neverAsked = 0;
  let raised = 0;
  const vantages = new Set<ValueVantage>();

  for (const { result } of measurement.answers) {
    if (result.outcome === "unsupported") {
      if (verdict === undefined) neverAsked += 1;
      continue;
    }
    if (result.outcome === "libraryError" || result.outcome === "adapterError") {
      if (verdict === undefined) raised += 1;
      continue;
    }
    if (verdict !== undefined && result.outcome !== verdict) continue;
    decided += 1;
    if (result.deserialized.kind === "observed") {
      observed += 1;
      if (Object.keys(result.deserialized.unreadable ?? {}).length > 0) partlyObserved += 1;
      vantages.add(result.deserialized.vantage);
    } else if (result.deserialized.kind === "unexposed") unexposed += 1;
    else notReached += 1;
  }

  return {
    decided,
    observed,
    partlyObserved,
    unexposed,
    notReached,
    neverAsked,
    raised,
    vantages: vantages.size === 0 ? "none" : [...vantages].map(vantageOf).join("; "),
  };
}

/** One side of a probe, said in a cell. */
function sideOf(side: ProbeSide): string {
  if (side.outcome === "unsupported") return `not asked (${side.detail ?? "no reason given"})`;
  if (side.outcome === "libraryError") return "raised, no verdict";
  if (side.outcome === "adapterError") return "harness error";
  const values =
    side.observation === "observed"
      ? side.exposedProbedName
        ? ", value exposed"
        : ", values exposed without the probed name"
      : side.observation === "unexposed"
        ? ", no values exposed"
        : ", no values reached";
  return `${side.outcome}${values}`;
}

/**
 * What the pair of sides says about the declaration, in words.
 *
 * The four readings are the point of the table. Declared and demonstrated is
 * the ordinary one. Declared and not demonstrated should never appear in a
 * committed report, because the gate refuses it. The two disclaimed readings
 * are the ones this table exists for: a disclaim nobody checked and a disclaim
 * the probe contradicted look identical in a capability column, and they are
 * different facts.
 */
function readingOf(entry: CapabilityEvidence): string {
  if (entry.stage === "splitting" && entry.supply === "withProbedLocation") {
    return "control only; the harness supplied this location, so this row is not evidence";
  }
  const how = demonstratedBy(entry);
  // `accepted / raised` never reads as `accepted / rejected`. The library
  // reached the stage, and it threw there rather than returning a verdict, so
  // an application driving it this way sees an exception. Both halves are in
  // the sentence.
  const shown =
    how === "byRaise"
      ? "exercised, and raised on the invalid side rather than returning a verdict"
      : how === "byExposedValue"
        ? "demonstrated by the value it exposed"
        : "demonstrated by the pair of verdicts";
  if (entry.declared) return how === null ? "declared, and this probe did not show it" : shown;
  return how === null ? "disclaimed, and not shown" : `disclaimed, and ${shown}`;
}

/**
 * The vantages a library actually reported in this run, rather than a yes/no
 * taken from what its adapter declared. A boolean could only say "yes" for a
 * library that reports from one point on an accepted request and a different
 * one on a rejected request, and "yes" is the least useful true thing to say
 * about it.
 */
function observedVantages(measurements: readonly LibraryMeasurement[], library: string): string {
  const seen = new Set<ValueVantage>();
  for (const measurement of measurements) {
    for (const { result } of measurement.answers) {
      if (result.library !== library) continue;
      if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
      if (result.deserialized.kind === "observed") seen.add(result.deserialized.vantage);
    }
  }
  if (seen.size === 0) return "none";
  // Ordered by the type's own declaration order, so the column does not reorder
  // itself when a library's results change.
  const order: readonly ValueVantage[] = [
    "handedToHandler",
    "parsedBeforeValidation",
    "validatedOnly",
  ];
  return order
    .filter((vantage) => seen.has(vantage))
    .map((vantage) => `\`${vantageOf(vantage)}\``)
    .join("; ");
}

/**
 * Whether a library recovers every part of a target for itself.
 *
 * Derived from the per-location stages rather than declared, because a single
 * declared boolean cannot answer for a library extracting its own path
 * parameters while refusing a query string: it answers neither yes nor no, and
 * a coarse answer would stamp a provenance record it had not earned.
 */
function splitsWholeTarget(capabilities: { stages: { splitting: Record<string, boolean> } }): boolean {
  const { splitting } = capabilities.stages;
  return splitting["path"] === true && splitting["query"] === true;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}
