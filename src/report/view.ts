import type { Case, Citation, ConformanceCase, Dimensions, ProbeAxis } from "../types/case";
import type { LibraryMeasurement } from "../types/measurement";
import type { AdapterResult } from "../types/result";
import type { PipelineStage, SplittableLocation } from "../types/pipeline";
import type { WireRequest } from "../types/wire";
import type { OasVersion, OpenApiDocument, ParameterObject } from "../types/openapi";
import { OAS_VERSIONS } from "../types/openapi";
import type { JsonValue } from "../types/json";
import { PIPELINE_STAGES, SPLITTABLE_LOCATIONS, ownsStage, probedStage } from "../types/pipeline";
import type { DeclaredType } from "../surface/surface";
import {
  DECLARED_TYPES,
  PROBE_AXES,
  cellKey,
  contentCellKey,
  definedContentSurface,
  definedSurface,
} from "../surface/surface";
import type { ContentCell, ContentCondition } from "../surface/surface";
import { score, type ConformanceOutcome } from "./score";

/**
 * The numbers a results report is made of, computed once and rendered by
 * something else.
 *
 * Separated from rendering because these are the part that can be quietly
 * wrong. A tally that double-counts or a disagreement rule that misses a case
 * produces a plausible page nobody can tell is false, so the derivations live
 * here under test and the renderer is left with nothing to decide.
 *
 * Everything is derived from measurements joined with the corpus they answered.
 * Nothing here knows a library's name, reputation, or what a good result would
 * look like: the same functions run over one measurement or twenty, over six
 * libraries or over six versions of one.
 */

/**
 * One measured thing, which is a library at a version rather than a library.
 *
 * The distinction is the whole reason this exists. A report over two versions
 * of one library has two entries whose `library` is identical, so a name cannot
 * be the key; a report over six libraries has six. `label` is what a reader
 * sees, and it is supplied rather than computed because the useful label
 * differs by intent: a version when comparing versions, a package name when
 * comparing libraries.
 */
export interface Entry {
  readonly label: string;
  readonly measurement: LibraryMeasurement;
}

/**
 * Every measurement in one order: package name, then whatever distinguishes two
 * measurements of the same package.
 *
 * Applied across the whole input rather than within each run. Sorting run by
 * run left the order of the columns decided by the order the caller typed
 * `--in`, so the same measurements produced different pages depending on how
 * they were passed, and two runs of six libraries interleaved as twelve columns
 * in two alphabetical halves. One order, always, so no library is ever first
 * for a reason and a page can be compared with another page.
 *
 * The secondary key is the discriminator rather than the label. A label is a
 * display string a caller may have chosen badly: `before` and `after` sort into
 * the wrong chronology, and nothing about a version comparison should turn on
 * that. Version, then when the run happened, then the image, then where the
 * file came from: the same chain the labels use, so a column's position and its
 * name always agree about what separates it.
 */
export function orderSources(sources: readonly EntrySource[]): readonly EntrySource[] {
  return [...sources].sort((one, other) => {
    const byMeasurement = compareMeasurements(one.measurement, other.measurement);
    if (byMeasurement !== 0) return byMeasurement;
    return (
      ascii(one.runStartedAt ?? "", other.runStartedAt ?? "") ||
      ascii(one.measurement.provenance.imageId, other.measurement.provenance.imageId) ||
      ascii(one.source, other.source)
    );
  });
}

/**
 * The order every library appears in, as a comparison two measurements can be
 * put through wherever one of them has to come first.
 *
 * The package name is the key everywhere in this repository, and a file name is
 * not: renaming a file must not move a column. It is compared from its first
 * letter or digit, because the punctuation an ecosystem puts in front of a name
 * is not part of the name. `@` sorts before every letter, so plain ASCII put
 * every scoped package at the head of the roster, and first on a page reads as
 * a finding rather than as a fact about how one registry spells a namespace.
 *
 * Only the leading run is dropped. Punctuation inside a name separates parts of
 * it, and a name compared with all of it removed would sort `some-library`
 * against `somelibrary`.
 *
 * The raw name breaks a tie, so `@scope/name` and `scope/name` still have an
 * order rather than one decided by which was read first. Version breaks the
 * next one, because two measurements of one package are two versions of it far
 * more often than anything else, and reading them in release order is the only
 * way the difference between them is a direction.
 */
export function compareMeasurements(one: LibraryMeasurement, other: LibraryMeasurement): number {
  return (
    compareLibraryNames(one.library, other.library) ||
    natural(one.libraryVersion, other.libraryVersion)
  );
}

/**
 * Two package names in the order a roster puts them.
 *
 * Exported because a name is sometimes all a caller has: a column heading read
 * back off a page, a list of files. One rule, in one place, or the roster and
 * whatever checks it disagree about who comes first.
 */
export function compareLibraryNames(one: string, other: string): number {
  return ascii(sortableName(one), sortableName(other)) || ascii(one, other);
}

/** A package name from its first letter or digit, which is where it reads from. */
function sortableName(library: string): string {
  return library.replace(/^[^a-z0-9]+/i, "");
}

/**
 * Measurements in that order, for a renderer handed a bare list.
 *
 * Ordering belongs to the thing that draws the columns rather than to the thing
 * that loaded the files. A renderer that sorts what it was given produces the
 * same picture from the same measurements however they reached it: read off
 * disk, collected by a caller, or assembled in a test. Anything else makes the
 * order a property of the loader, and every new caller is another chance for a
 * library to appear first for a reason.
 */
export function orderMeasurements(
  measurements: readonly LibraryMeasurement[],
): readonly LibraryMeasurement[] {
  return [...measurements].sort(compareMeasurements);
}

/**
 * Labelled entries in that order.
 *
 * The sort is stable, so entries `orderSources` already separated by run time,
 * image or file keep the order it gave them: this settles the package name and
 * the version and leaves the rest of that chain alone.
 */
export function orderEntries(entries: readonly Entry[]): readonly Entry[] {
  return [...entries].sort((one, other) => compareMeasurements(one.measurement, other.measurement));
}

function ascii(one: string, other: string): number {
  return one < other ? -1 : one > other ? 1 : 0;
}

/**
 * Compare two version strings with their digit runs read as numbers.
 *
 * Plain ASCII order puts `5.10.0` before `5.6.2`, which would present an
 * upgrade as a downgrade and label the delta backwards. This is not a semantic
 * version parser and does not try to be: it splits digit runs from the rest and
 * compares numerically where both sides have digits, which is right for the
 * common shapes and degrades to ASCII for anything else, including prerelease
 * suffixes, where it will order `1.0.0-rc1` after `1.0.0` rather than before.
 */
function natural(one: string, other: string): number {
  const split = (value: string): string[] => value.split(/(\d+)/).filter((part) => part !== "");
  const a = split(one);
  const b = split(other);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const bothNumeric = /^\d+$/.test(left) && /^\d+$/.test(right);
    const compared = bothNumeric ? Number(left) - Number(right) : ascii(left, right);
    if (compared !== 0) return compared < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * A measurement as it arrived, before it has a name a reader can use.
 *
 * `source` and `runStartedAt` exist only to break ties. Neither belongs on a
 * page describing results, and both are the difference between two columns
 * when nothing else is.
 */
export interface EntrySource {
  readonly measurement: LibraryMeasurement;
  /** What the caller asked this column to be called, where they said. */
  readonly explicitLabel: string | null;
  /** From the run sidecar beside the measurement, when there is one. */
  readonly runStartedAt: string | null;
  /** Where it was read from, as a last resort for telling two apart. */
  readonly source: string;
}

/**
 * Give every entry a label a reader can tell apart from the others.
 *
 * The package name alone is the right label until two entries share it, which
 * is exactly what happens in the case this was built for: the same library
 * measured twice. Two columns both reading `some-library` leave a reader with
 * no way to know which is which, and the version comparison then reads "what
 * moved: x, x to x".
 *
 * So a colliding group gets the first qualifier that actually separates it:
 * the version, then when the runs are the same version the time each ran, then
 * the image they ran from, then where the file came from. Two runs of one
 * version of one library from one image differ only in when they happened,
 * which is the fact the run sidecar carries and the reason it is worth having.
 * An index is the last resort and means the inputs were indistinguishable.
 */
export function resolveLabels(sources: readonly EntrySource[]): readonly Entry[] {
  const base = (source: EntrySource): string =>
    source.explicitLabel === null
      ? source.measurement.library
      : `${source.measurement.library} ${source.explicitLabel}`;

  // Grouped by position rather than by object, because two inputs can be the
  // same measurement read twice, or literally the same object, and keying on
  // identity silently merged them into one column.
  const groups = new Map<string, number[]>();
  sources.forEach((source, index) => {
    const name = base(source);
    groups.set(name, [...(groups.get(name) ?? []), index]);
  });

  const qualifiers: readonly ((source: EntrySource) => string)[] = [
    (source) => source.measurement.libraryVersion,
    (source) => source.runStartedAt ?? "",
    (source) => source.measurement.provenance.imageId.slice(7, 19),
    (source) => source.source,
  ];

  const labelled: string[] = Array.from({ length: sources.length }, () => "");
  for (const [name, group] of groups) {
    const first = group[0];
    if (group.length === 1 && first !== undefined) {
      labelled[first] = name;
      continue;
    }
    const members = group.map((index) => sources[index] as EntrySource);
    const separating = qualifiers.find(
      (qualifier) => new Set(members.map(qualifier)).size === group.length,
    );
    group.forEach((position, ordinal) => {
      const source = sources[position] as EntrySource;
      const suffix = separating === undefined ? `#${String(ordinal + 1)}` : separating(source);
      labelled[position] = `${name} ${suffix}`;
    });
  }

  return sources.map((source, index) => ({
    label: labelled[index] === undefined || labelled[index] === "" ? base(source) : labelled[index],
    measurement: source.measurement,
  }));
}

/** The specification versions the given cases cite, in ASCII order. */
export function presentVersions(cases: readonly Case[]): readonly OasVersion[] {
  return [...new Set(cases.map((c) => c.oasVersion))].sort();
}

/**
 * The file-name fragment a specification version renders under.
 *
 * `3.1` becomes `oas31`, so the per-version artifacts are `matrix.oas31.md`
 * and `coverage.oas31.md`. One function rather than string surgery at each
 * site, so every renderer names the same files.
 */
export function versionSlug(version: OasVersion): string {
  return `oas${version.replace(".", "")}`;
}

/** The matrix file a case's rules are quoted in, by the case's own version. */
export function matrixFileName(version: OasVersion): string {
  return `matrix.${versionSlug(version)}.md`;
}

/**
 * What one case asks, as a block of text a reader can be shown beside the id.
 *
 * A case id is a name for a question, and a table of ids is a table of names
 * with the questions somewhere else. Nothing here is computed, so this can add
 * nothing the corpus does not already say and cannot disagree with the file a
 * reader would check it against.
 *
 * Ordered for someone scanning. The plain sentence and the request come first,
 * because "what is this one doing" is the question a reader hovering a row has,
 * and the argument for the verdict is the question they have after that. An
 * earlier version led with the argument and ran past a thousand characters,
 * which answered the second question well and the first one not at all.
 *
 * The citations are named and not quoted. A quote is what makes a conformance
 * failure attributable, and it was more than a third of everything hovering
 * showed, spent on the part of a case a reader scanning never reads. The names
 * are the trail to the quotes, which sit next to the same case in the matrix
 * file for the case's version.
 * That file is a separate rendering of the same directory, so the note names
 * the command that writes it rather than assuming someone has.
 *
 * The two tiers read differently on purpose. A conformance note says what the
 * specification requires and which text requires it. A divergence note asks a
 * question and names the specification declining to answer it, so nothing in it
 * can be mistaken for an expected result.
 */
export function caseNote(testCase: Case): string {
  // `inShort` leads because it is the one line written for a reader who does
  // not know the serialization vocabulary; the coordinates it compresses are
  // on the `shape` line below, so the title would repeat them.
  const lines: string[] = [testCase.inShort, ""];

  // The facts about this one case, in a fixed column so the eye can drop down
  // the labels and stop at the one it came for. A hover is unstyled text with
  // no room for anything else to distinguish them.
  const facts: [string, string][] = [];
  const [target, ...carried] = sentLines(testCase.request);
  facts.push(["sends", target ?? ""]);
  for (const carriedLine of carried) facts.push(["", carriedLine]);
  for (const declaration of declaredLines(testCase.document)) {
    facts.push([facts.some(([label]) => label === "declares") ? "" : "declares", declaration]);
  }

  if (testCase.tier === "conformance") {
    facts.push(["expects", testCase.expected]);
    if (testCase.expectedValues !== null) {
      facts.push(["values", JSON.stringify(testCase.expectedValues)]);
    }
  }

  const width = Math.max(...facts.map(([label]) => label.length)) + 2;
  for (const [label, value] of facts) {
    lines.push(`${(label === "" ? "" : `${label}:`).padEnd(width)}${value}`);
  }

  if (testCase.answeredInValues === true) {
    lines.push(
      "answered in the values: the verdict cannot carry this finding, so a library that " +
        "exposes no deserialized values reaches a verdict here and answers nothing.",
    );
  }

  lines.push("");
  if (testCase.tier === "conformance") {
    lines.push(`why: ${testCase.rationale}`);
  } else {
    lines.push(`open question: ${testCase.question}`);
  }

  lines.push(
    `varies: ${
      testCase.varies.length === 0 ? "nothing, this is the canonical case" : testCase.varies.join("; ")
    }`,
  );
  lines.push(`holds constant: ${testCase.holdsConstant.join("; ")}`);
  lines.push(`shape: ${describeDimensions(testCase.dimensions)}`);

  if (testCase.breaksDocumentRule !== undefined) {
    lines.push(
      `the document breaks a rule addressed to whoever wrote it, on purpose: ${testCase.breaksDocumentRule.detail}`,
    );
  }

  if (testCase.tier === "conformance") {
    lines.push(`required by, in OAS ${testCase.oasVersion}: ${anchors(testCase.citations)}`);
    lines.push(
      `quoted in full beside this case in ${matrixFileName(testCase.oasVersion)}, which pnpm render-md writes.`,
    );
  } else if (testCase.basis === null) {
    lines.push(`left open in OAS ${testCase.oasVersion} by silence, so there is no rule to name.`);
  } else {
    lines.push(`left open in OAS ${testCase.oasVersion} by: ${testCase.basis.anchor}`);
    lines.push(
      `quoted in full beside this case in ${matrixFileName(testCase.oasVersion)}, which pnpm render-md writes.`,
    );
  }

  return lines.join("\n");
}

/** Every case's note, keyed by id, for a renderer holding an id and nothing else. */
export function caseNotes(cases: readonly Case[]): ReadonlyMap<string, string> {
  return new Map(cases.map((testCase) => [testCase.id, caseNote(testCase)]));
}

/**
 * The rules a case rests on, named rather than quoted. The quotes are in
 * the version's matrix file, beside the same case.
 */
function anchors(citations: readonly Citation[]): string {
  return citations.map((citation) => citation.anchor).join(", ");
}

/**
 * The request, as the target line and one line per header it carries.
 *
 * `Host` is dropped because every case sends the same one, and a line that is
 * identical on every case is a line a reader learns to skip past the ones that
 * are not.
 */
function sentLines(request: WireRequest): readonly string[] {
  const headers = (request.headers ?? []).filter(([name]) => name.toLowerCase() !== "host");
  return [
    `${request.method} ${request.target}`,
    ...headers.map(([name, value]) => `${name}: ${value}`),
  ];
}

/**
 * What the document declares, one line per parameter.
 *
 * Without this the note showed a request and left the reader to work out from
 * the title which of its parts the document was talking about, which is hardest
 * exactly where it matters most: a header case looks like a request with a
 * header in it, and nothing said the header was the parameter.
 *
 * Read off the document rather than the dimensions. The dimensions are the
 * corpus's own coordinates and say `style form, explode true`; this is the
 * declaration a library was handed, including the path template that binds a
 * segment to a name.
 */
function declaredLines(document: OpenApiDocument): readonly string[] {
  const templates = Object.keys(document.paths);
  const lines: string[] = [];
  for (const template of templates) {
    const parameters = document.paths[template]?.get?.parameters ?? [];
    // The template only earns a line where it carries something: a case
    // declaring several paths is asking which one matches.
    const prefix = templates.length > 1 ? `${template}: ` : "";
    if (parameters.length === 0) lines.push(`${template} (no parameters)`);
    for (const parameter of parameters) lines.push(prefix + describeParameter(parameter));
  }
  return lines;
}

function describeParameter(parameter: ParameterObject): string {
  const parts = [`${parameter.name} in ${parameter.in}`];
  if (parameter.required === true) parts.push("required");
  if (parameter.style !== undefined) parts.push(`style ${parameter.style}`);
  if (parameter.explode !== undefined) parts.push(`explode ${String(parameter.explode)}`);
  if (parameter.allowReserved === true) parts.push("allowReserved");
  if (parameter.allowEmptyValue === true) parts.push("allowEmptyValue");
  for (const [mediaType, media] of Object.entries(parameter.content ?? {})) {
    parts.push(`content ${mediaType} ${describeSchema(media.schema)}`);
  }
  if (parameter.schema !== undefined) parts.push(describeSchema(parameter.schema));
  return parts.join(", ");
}

/**
 * A schema as the shape and the types inside it.
 *
 * The types are the point. A note saying `object` leaves a reader of a
 * wrong-type case guessing which property was supposed to be what, and that is
 * the whole question the case asks.
 */
function describeSchema(schema: JsonValue | undefined): string {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return "schema";
  const shape = schema as Record<string, JsonValue>;
  const type = shape["type"];
  const named = Array.isArray(type) ? type.filter((one) => typeof one === "string").join(" or ") : type;
  if (named === "array") return `array of ${describeSchema(shape["items"])}`;
  const properties = shape["properties"];
  if (named === "object" && properties !== null && typeof properties === "object") {
    const listed = Object.entries(properties as Record<string, JsonValue>)
      .map(([name, property]) => `${name} ${describeSchema(property)}`)
      .join(", ");
    return `object with ${listed}`;
  }
  return typeof named === "string" ? named : "schema";
}

/**
 * A case's coverage coordinates, in words.
 *
 * Defaulted is called out because it is a different code path and the corpus
 * treats it as a different cell: a library resolving `style` from the location
 * has done work a library handed the style did not.
 */
function describeDimensions(dimensions: Dimensions): string {
  const parts: string[] = [dimensions.location, dimensions.schema];
  if (dimensions.declaration === "schema") {
    parts.push(
      `style ${dimensions.style}${dimensions.declaredStyle === "unset" ? " (defaulted)" : ""}`,
      `explode ${String(dimensions.explode)}${dimensions.declaredExplode === "unset" ? " (defaulted)" : ""}`,
    );
  } else {
    parts.push(`content ${dimensions.mediaType}`);
  }
  parts.push(`axis ${dimensions.probeAxis}`);
  return parts.join(", ");
}

export interface StageSlot {
  readonly stage: PipelineStage;
  readonly location: SplittableLocation | null;
  readonly title: string;
  /** What work this slot names, for a reader who has not read `pipeline.ts`. */
  readonly description: string;
}

/**
 * What each stage is, in one sentence.
 *
 * The pipeline is the frame the whole roster is drawn in, and a strip of nine
 * segments labelled `styleDeserialization` and `split: cookie` assumes a reader
 * who already knows what those are. A reader who does not cannot tell a library
 * that delegates a stage from one that fails it, which is the single distinction
 * the roster exists to make.
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
        description: SPLIT_DESCRIPTIONS[location],
      }))
    : [{ stage, location: null, title: stage, description: STAGE_DESCRIPTIONS[stage] }],
);

export interface RosterRow {
  readonly label: string;
  readonly library: string;
  readonly libraryVersion: string;
  /** What the container said about where its library's source is, or `null`. */
  readonly librarySource: string | null;
  /** Set when the measured library did not come from a public registry. */
  readonly localBuild: string | null;
  readonly ecosystem: string;
  readonly configurationId: string;
  readonly imageId: string;
  /** The OpenAPI versions the container declares its library accepts. */
  readonly oasVersions: readonly OasVersion[];
  /** Owned or delegated, in `STAGE_SLOTS` order. */
  readonly owns: readonly boolean[];
  readonly ownedCount: number;
  readonly stageCount: number;
}

export function roster(entries: readonly Entry[]): readonly RosterRow[] {
  return entries.map(({ label, measurement }) => {
    const owns = STAGE_SLOTS.map((slot) =>
      ownsStage(measurement.capabilities.stages, slot.stage, slot.location ?? "path"),
    );
    return {
      label,
      library: measurement.library,
      libraryVersion: measurement.libraryVersion,
      librarySource: measurement.librarySource,
      localBuild:
        measurement.libraryResolution.kind === "local"
          ? (measurement.libraryResolution.specifier ?? "a local source")
          : null,
      ecosystem: measurement.provenance.ecosystem,
      configurationId: measurement.configuration.id,
      imageId: measurement.provenance.imageId,
      oasVersions: OAS_VERSIONS.filter((version) => measurement.capabilities.oasVersions[version]),
      owns,
      ownedCount: owns.filter(Boolean).length,
      stageCount: owns.length,
    };
  });
}

/**
 * The conformance outcomes one measurement produced, counted.
 *
 * Computed and deliberately not published side by side with another
 * measurement's. Measurements are asked different numbers of cases, so two rows
 * of these counts have different denominators and cannot be compared, and a
 * table of them invites the comparison anyway because the eye sorts a column of
 * numbers whatever the caption says. Across measurements the reports publish
 * which case produced which outcome. Within one measurement, where the
 * denominator travels with the number, a count says something true, and
 * `display.ts` is the one caller: a library's own file is the only artifact
 * that publishes these, and it publishes the total beside them.
 */
export interface ConformanceTally {
  readonly label: string;
  readonly counts: Readonly<Record<ConformanceOutcome, number>>;
  readonly total: number;
}

export const CONFORMANCE_OUTCOMES: readonly ConformanceOutcome[] = [
  "pass",
  "passVerdictOnly",
  "failVerdict",
  "failValue",
  "libraryError",
  "adapterError",
  "notApplicable",
];

export function conformanceTallies(
  cases: readonly Case[],
  entries: readonly Entry[],
): readonly ConformanceTally[] {
  const conformance = cases.filter((c): c is ConformanceCase => c.tier === "conformance");
  return entries.map(({ label, measurement }) => {
    const counts: Record<ConformanceOutcome, number> = {
      pass: 0,
      passVerdictOnly: 0,
      failVerdict: 0,
      failValue: 0,
      libraryError: 0,
      adapterError: 0,
      notApplicable: 0,
    };
    for (const testCase of conformance) {
      const result = answerFor(measurement, testCase.id);
      // A case the measurement has no answer for is counted as unasked rather
      // than skipped, so every row sums to the same total and a reader can see
      // that it does.
      counts[result === undefined ? "notApplicable" : score(testCase, result)] += 1;
    }
    return { label, counts, total: conformance.length };
  });
}

/**
 * One conformance case, as every measurement answered it.
 *
 * No expected verdict. An outcome is already scored against it, so a column of
 * expectations sits beside a grid that has applied them, saying `accepted` next
 * to a row of `pass` and inviting a reader to check an arithmetic nobody did by
 * hand. The expectation belongs with the case, and `caseNote` carries it there.
 */
export interface ConformanceRow {
  readonly caseId: string;
  /** In `entries` order, so a column is one measurement throughout. */
  readonly outcomes: readonly ConformanceOutcome[];
}

/**
 * Every conformance case and what each measurement answered.
 *
 * The cross-measurement view, and the counted one above is not. A grid says
 * which case produced which outcome, which is a fact a reader can take to the
 * case expansion and check. A row of totals says how many, which is a summary
 * of facts whose denominators differ, and it reads as a score.
 */
export function conformanceGrid(
  cases: readonly Case[],
  entries: readonly Entry[],
): readonly ConformanceRow[] {
  return cases
    .filter((c): c is ConformanceCase => c.tier === "conformance")
    .map((testCase) => ({
      caseId: testCase.id,
      outcomes: entries.map((entry) => outcomeOf(testCase, entry.measurement)),
    }));
}

/** One divergence case, as every measurement answered it. */
export interface DivergenceRow {
  readonly caseId: string;
  readonly title: string;
  /** Whether the verdict can carry this case's finding at all. */
  readonly answeredInValues: boolean;
  /** In `entries` order, so a column is one measurement throughout. */
  readonly answers: readonly { readonly verdict: string; readonly values: string }[];
}

/**
 * Every divergence case and what each measurement returned.
 *
 * Separate from `disagreements` even though both are about the divergence tier,
 * because they answer different questions. That one asks where the measurements
 * parted, and skips a case they all answered alike. This one is the tier
 * itself, and a case every measurement agreed on belongs in it: agreement on a
 * question the specification leaves open is a finding, and a surface that shows
 * only the disagreements cannot report it.
 *
 * No outcome and no expectation, because the specification settles nothing
 * here, so there is nothing to be right about.
 */
export function divergenceGrid(
  cases: readonly Case[],
  entries: readonly Entry[],
): readonly DivergenceRow[] {
  return cases
    .filter((c) => c.tier === "divergence")
    .map((testCase) => ({
      caseId: testCase.id,
      title: testCase.title,
      answeredInValues: testCase.answeredInValues === true,
      answers: entries.map((entry) => {
        const result = answerFor(entry.measurement, testCase.id);
        return {
          verdict: describeVerdict(result),
          values: result === undefined ? "-" : describeValues(result),
        };
      }),
    }));
}

/** What a measurement answered, keeping "never asked" apart from "refused". */
export function describeVerdict(result: AdapterResult | undefined): string {
  if (result === undefined) return "not asked";
  if (result.outcome === "unsupported") return `not asked (${result.reason})`;
  if (result.outcome === "adapterError") return "harness error";
  if (result.outcome === "libraryError") return "raised, no verdict";
  return result.outcome;
}

/** Coverage of the two enumerated surfaces, and of the probe axes. */
export interface CoverageView {
  readonly styleDefined: number;
  readonly styleCovered: number;
  readonly contentDefined: number;
  readonly contentCovered: number;
  readonly byStage: readonly { stage: PipelineStage; conformance: number; divergence: number }[];
  readonly byAxis: readonly { axis: string; cases: number }[];
  readonly byDeclaration: readonly { declaration: string; cases: number }[];
  /**
   * Which declared value types the corpus has cases for, and which of those
   * cases put a value of the wrong type at one.
   */
  readonly byType: readonly {
    type: DeclaredType;
    declaredBy: readonly string[];
    wrongValueBy: readonly string[];
  }[];
  readonly conformance: number;
  readonly divergence: number;
}

/**
 * Every type a case's document declares, anywhere in its schemas.
 *
 * Read off the document rather than declared beside the case, the same rule
 * `probedStage` follows: the document already says this, and a hand-written
 * label next to it is a second source that can disagree. It walks into
 * properties and items because the hole this axis exists for was exactly
 * there, in the types of an object's properties rather than the shape of the
 * object.
 */
export function declaredTypes(document: OpenApiDocument): ReadonlySet<DeclaredType> {
  const found = new Set<DeclaredType>();
  const walk = (schema: JsonValue | undefined): void => {
    if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return;
    const shape = schema as Record<string, JsonValue>;
    const declared = shape["type"];
    for (const one of Array.isArray(declared) ? declared : [declared]) {
      if (typeof one === "string" && (DECLARED_TYPES as readonly string[]).includes(one)) {
        found.add(one as DeclaredType);
      }
    }
    walk(shape["items"]);
    const properties = shape["properties"];
    if (properties !== null && typeof properties === "object" && !Array.isArray(properties)) {
      for (const property of Object.values(properties as Record<string, JsonValue>)) walk(property);
    }
  };
  for (const item of Object.values(document.paths)) {
    for (const parameter of item.get?.parameters ?? []) {
      walk(parameter.schema);
      for (const media of Object.values(parameter.content ?? {})) walk(media.schema);
    }
  }
  return found;
}

/**
 * Which half of the condition axis a content case fills.
 *
 * Read from the axis it varies rather than from a field of its own. A case
 * whose value is not a representation of its declared media type carries
 * `foreignWireShape`, which is the same axis a style case carries when its wire
 * form belongs to another style, and both mean the bytes do not conform to the
 * declared serialization.
 *
 * A case that sends no value at all fills neither half, and there is more than
 * one way to send none: a required name absent, an optional one omitted, a name
 * arriving with no delimiter after it. Negating one axis would have marked
 * `wellFormed` covered for a case whose whole point is that no representation
 * was sent, which overstates coverage in the table that shows open cells.
 */
const SENDS_NO_REPRESENTATION: ReadonlySet<ProbeAxis> = new Set([
  "missingName",
  "nameWithoutValue",
  "optionalAbsent",
]);

export function contentConditionOf(testCase: Case): ContentCondition | null {
  if (SENDS_NO_REPRESENTATION.has(testCase.dimensions.probeAxis)) return null;
  return testCase.dimensions.probeAxis === "foreignWireShape" ? "malformed" : "wellFormed";
}

/**
 * Where the content cases land on the content surface.
 *
 * One function because the count and the table are the same claim. They were
 * computed twice, one of them dropping the `condition` axis, so the JSON said
 * twelve cells defined where the markdown drew twenty-four. A number and a
 * picture that disagree cannot both be the measurement.
 *
 * Cases are placed rather than counted, so one landing outside the axes can be
 * named instead of vanishing. A case declaring a media type this surface does
 * not enumerate produces a key matching no cell, and silently dropping it would
 * let the coverage number ignore a case the corpus really contains.
 */
export function placeContentCases(cases: readonly Case[]): {
  readonly defined: readonly ContentCell[];
  readonly covered: ReadonlySet<string>;
  readonly offSurface: readonly string[];
} {
  const defined = definedContentSurface();
  const definedKeys = new Set(defined.map(contentCellKey));

  const placed = cases.flatMap((testCase) => {
    if (testCase.dimensions.declaration !== "content") return [];
    // A case breaking a rule addressed to whoever wrote the document varies the
    // declaration rather than the representation, so it fills no cell here.
    if (testCase.breaksDocumentRule !== undefined) return [];
    const condition = contentConditionOf(testCase);
    if (condition === null) return [];
    return [
      {
        id: testCase.id,
        key: contentCellKey({
          location: testCase.dimensions.location,
          mediaType: testCase.dimensions.mediaType,
          schema: testCase.dimensions.schema,
          condition,
        }),
      },
    ];
  });

  return {
    defined,
    covered: new Set(placed.filter((entry) => definedKeys.has(entry.key)).map((entry) => entry.key)),
    offSurface: placed.filter((entry) => !definedKeys.has(entry.key)).map((entry) => entry.id),
  };
}

export function coverage(cases: readonly Case[]): CoverageView {
  const styleKeys = new Set(
    cases.flatMap((c) => (c.dimensions.declaration === "schema" ? [cellKey(c.dimensions)] : [])),
  );
  const content = placeContentCases(cases);

  const typed = DECLARED_TYPES.map((type) => {
    const declaredBy = cases.filter((c) => declaredTypes(c.document).has(type));
    return {
      type,
      declaredBy: declaredBy.map((c) => c.id),
      wrongValueBy: declaredBy
        .filter((c) => c.dimensions.probeAxis === "wrongTypeValue")
        .map((c) => c.id),
    };
  });

  return {
    byType: typed,
    styleDefined: definedSurface().length,
    styleCovered: definedSurface().filter((cell) => styleKeys.has(cellKey(cell))).length,
    contentDefined: content.defined.length,
    contentCovered: content.covered.size,
    // `valueExposure` is absent by construction rather than empty: no case can
    // probe it, because a case probes a stage by varying something until the
    // verdict moves and exposure moves no verdict.
    byStage: PIPELINE_STAGES.filter((stage) => stage !== "valueExposure").map((stage) => {
      const probing = cases.filter((c) => probedStage(c.dimensions) === stage);
      return {
        stage,
        conformance: probing.filter((c) => c.tier === "conformance").length,
        divergence: probing.filter((c) => c.tier === "divergence").length,
      };
    }),
    byAxis: PROBE_AXES.map((axis) => ({
      axis,
      cases: cases.filter((c) => c.dimensions.probeAxis === axis).length,
    })),
    byDeclaration: (["schema", "content"] as const).map((declaration) => ({
      declaration,
      cases: cases.filter((c) => c.dimensions.declaration === declaration).length,
    })),
    conformance: cases.filter((c) => c.tier === "conformance").length,
    divergence: cases.filter((c) => c.tier === "divergence").length,
  };
}

/**
 * A case where the measurements did not answer alike.
 *
 * Two kinds, and keeping them apart is the point. A verdict split is visible in
 * any results table. A value split is not: every measurement accepted, so a
 * verdict column shows a row of agreement while the callers of those libraries
 * receive different values. That second kind is what a matrix of verdicts hides
 * and it is worth surfacing on its own.
 */
export interface Disagreement {
  readonly caseId: string;
  readonly title: string;
  readonly tier: "conformance" | "divergence";
  readonly kind: "value" | "verdict";
  readonly answers: readonly { label: string; verdict: string; values: string }[];
}

export function disagreements(
  cases: readonly Case[],
  entries: readonly Entry[],
): readonly Disagreement[] {
  const found: Disagreement[] = [];
  for (const testCase of cases) {
    // Only measurements that reached a verdict can disagree. One that was never
    // asked is not a dissenting opinion, and counting it as one would turn a
    // capability difference into a finding about the specification.
    const answered = entries.flatMap((entry) => {
      const result = answerFor(entry.measurement, testCase.id);
      if (result === undefined) return [];
      if (result.outcome !== "accepted" && result.outcome !== "rejected") return [];
      return [{ label: entry.label, result }];
    });
    if (answered.length < 2) continue;

    const verdicts = new Set(answered.map((entry) => entry.result.outcome));
    const exposed = answered.flatMap((entry) =>
      entry.result.outcome === "accepted" || entry.result.outcome === "rejected"
        ? entry.result.deserialized.kind === "observed"
          ? [JSON.stringify(entry.result.deserialized.value)]
          : []
        : [],
    );
    const valuesSplit = new Set(exposed).size > 1;
    if (verdicts.size < 2 && !valuesSplit) continue;

    found.push({
      caseId: testCase.id,
      title: testCase.title,
      tier: testCase.tier,
      kind: verdicts.size > 1 ? "verdict" : "value",
      answers: answered.map((entry) => ({
        label: entry.label,
        verdict: entry.result.outcome,
        values: describeValues(entry.result),
      })),
    });
  }
  return found;
}

/**
 * The verdict splits where the field parted most evenly, for a reader who has
 * just arrived.
 *
 * A rule rather than a hand-picked list, so nobody chooses which disagreements
 * look interesting. Evenness first: a case eight libraries answered one way and
 * one the other is a near-consensus with an outlier, and one they halve is a
 * question the field has not settled. Then the number that answered, because a
 * split among ten is more of the field than the same split among three. Then
 * the case id, so the list is stable.
 *
 * Only verdict splits. A value split is a disagreement about what a caller
 * receives rather than about what the request means, and mixing the two would
 * put them in one order as if they were the same quantity.
 *
 * One entry per coordinate, versions collapsed. A case and its mirror in the
 * other specification version are the same question asked twice, and a list of
 * four that shows two of them twice is a list of two.
 *
 * Nothing here reads a library's name. The order is a property of the case.
 */
export function sharpestSplits(
  found: readonly Disagreement[],
  limit: number,
): readonly { disagreement: Disagreement; accepted: number; rejected: number }[] {
  return found
    .filter((one) => one.kind === "verdict")
    .map((disagreement) => ({
      disagreement,
      accepted: disagreement.answers.filter((a) => a.verdict === "accepted").length,
      rejected: disagreement.answers.filter((a) => a.verdict === "rejected").length,
    }))
    .sort((one, other) => {
      const evenness = (split: { accepted: number; rejected: number }): number =>
        Math.min(split.accepted, split.rejected) / (split.accepted + split.rejected);
      return (
        evenness(other) - evenness(one) ||
        other.disagreement.answers.length - one.disagreement.answers.length ||
        (one.disagreement.caseId < other.disagreement.caseId ? -1 : 1)
      );
    })
    .filter(dedupeByCoordinate())
    .slice(0, limit);
}

/**
 * Keeps the first entry for each case coordinate, which is the case id with the
 * specification version it was asked under taken off the end.
 */
function dedupeByCoordinate(): (split: { disagreement: Disagreement }) => boolean {
  const seen = new Set<string>();
  return (split) => {
    const coordinate = split.disagreement.caseId.replace(/-oas\d+$/, "");
    if (seen.has(coordinate)) return false;
    seen.add(coordinate);
    return true;
  };
}

/**
 * What changed between two measurements of the same library.
 *
 * Only produced for entries sharing a package name, because that is when a
 * difference is a change rather than a comparison. Across two libraries a
 * differing cell is a disagreement; across two versions of one it is something
 * that moved, and calling it either thing when it is the other would mislead.
 */
export interface VersionDelta {
  readonly library: string;
  readonly from: string;
  readonly to: string;
  readonly moved: readonly {
    caseId: string;
    before: ConformanceOutcome;
    after: ConformanceOutcome;
  }[];
}

export function versionDeltas(
  cases: readonly Case[],
  entries: readonly Entry[],
): readonly VersionDelta[] {
  const conformance = cases.filter((c): c is ConformanceCase => c.tier === "conformance");
  const byLibrary = new Map<string, Entry[]>();
  for (const entry of entries) {
    const existing = byLibrary.get(entry.measurement.library) ?? [];
    existing.push(entry);
    byLibrary.set(entry.measurement.library, existing);
  }

  const deltas: VersionDelta[] = [];
  for (const [library, group] of byLibrary) {
    if (group.length < 2) continue;
    // Consecutive pairs, rather than every pair. Entries arrive in
    // discriminator order, so a report of three versions shows two transitions
    // and each reads from the earlier to the later.
    for (let index = 1; index < group.length; index += 1) {
      const before = group[index - 1];
      const after = group[index];
      if (before === undefined || after === undefined) continue;
      const moved = conformance.flatMap((testCase) => {
        const one = outcomeOf(testCase, before.measurement);
        const two = outcomeOf(testCase, after.measurement);
        return one === two ? [] : [{ caseId: testCase.id, before: one, after: two }];
      });
      deltas.push({ library, from: before.label, to: after.label, moved });
    }
  }
  return deltas;
}

function outcomeOf(testCase: ConformanceCase, measurement: LibraryMeasurement): ConformanceOutcome {
  const result = answerFor(measurement, testCase.id);
  return result === undefined ? "notApplicable" : score(testCase, result);
}

function answerFor(measurement: LibraryMeasurement, caseId: string): AdapterResult | undefined {
  return measurement.answers.find((answer) => answer.caseId === caseId)?.result;
}

/** The value channel in one cell, keeping the three observations distinct. */
export function describeValues(result: AdapterResult): string {
  if (result.outcome !== "accepted" && result.outcome !== "rejected") return "-";
  const observation = result.deserialized;
  if (observation.kind === "unexposed") return "not exposed by this library";
  if (observation.kind === "notReached") return "none reached";
  return JSON.stringify(observation.value);
}

/**
 * Whether the entries answered the same questions.
 *
 * A report joining measurements on case id is only meaningful when the ids mean
 * the same thing in each, and the digest is what says so. Reported rather than
 * enforced: comparing runs over different corpora is a legitimate thing to want
 * to look at, and a page that shows the answers while stating that the
 * questions differed is more useful than one that refuses to render.
 */
export function corpusAgreement(entries: readonly Entry[]): {
  readonly agreed: boolean;
  readonly digests: readonly string[];
} {
  const digests = [...new Set(entries.map((entry) => entry.measurement.corpusDigest))];
  return { agreed: digests.length <= 1, digests };
}
