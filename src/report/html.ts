import type { Case } from "../types/case";
import type { OasVersion } from "../types/openapi";
import type { RunSidecarState } from "./read";
import type { ConformanceOutcome } from "./score";
import type { Disagreement } from "./view";
import {
  CONFORMANCE_OUTCOMES,
  STAGE_SLOTS,
  caseNotes,
  conformanceGrid,
  corpusAgreement,
  coverage,
  disagreements,
  sharpestSplits,
  divergenceGrid,
  orderEntries,
  matrixFileName,
  presentVersions,
  versionSlug,
  roster,
  versionDeltas,
  type Entry,
} from "./view";

/**
 * One page of results, from measurements joined with the corpus they answered.
 *
 * Deliberately thin. Every number here comes from `view.ts`, which is under
 * test; this file decides where things sit on a page and nothing else, so a
 * mistake in it is visible to anyone looking at the page rather than silently
 * inconsistent in a way only a re-derivation would catch.
 *
 * What the page will not say: whether a result is good, which library a reader
 * should choose, or anything about the harness that produced it. It reports
 * what was measured. Entries are whatever the caller passed, which may be six
 * libraries, or one library at six versions, and the page reads the same way
 * either way because nothing in it assumes the entries are different libraries.
 *
 * Nothing here totals one measurement against another. A count per measurement
 * is a score whatever it is captioned, and the measurements do not even share a
 * denominator, so across measurements this page publishes which case produced
 * which outcome and leaves the arithmetic undone.
 */

const OUTCOME_LABEL: Record<ConformanceOutcome, string> = {
  pass: "pass",
  passVerdictOnly: "verdict only",
  failVerdict: "fail (verdict)",
  failValue: "fail (value)",
  libraryError: "raised",
  adapterError: "harness error",
  notApplicable: "not asked",
};

/**
 * What each chip means, one line each.
 *
 * Keyed by outcome rather than written as prose, so the key covers every chip
 * the grid can draw, including the ones a reader is most likely to take for
 * granted: what separates a pass from a pass on the verdict alone, and a
 * verdict mismatch from a matching verdict carrying mismatched values.
 */
const OUTCOME_NOTE: Record<ConformanceOutcome, string> = {
  pass: "The verdict the specification settles, and its values where the specification settles those too.",
  passVerdictOnly:
    "The settled verdict, from a library that exposes no deserialized values, so the value half of the case could not be asked of it.",
  failVerdict: "It reached the opposite verdict.",
  failValue:
    "It reached the settled verdict and handed back values the specification settles differently.",
  libraryError:
    "It threw instead of answering, which is attributable to it. An application would have seen an exception rather than a refusal.",
  adapterError: "An error in the adapter or the harness rather than an answer from the library.",
  notApplicable:
    "It was never given the case, because it does not perform the stage the case probes. The reason is in capabilities.md.",
};

const OUTCOME_CLASS: Record<ConformanceOutcome, string> = {
  pass: "pass",
  passVerdictOnly: "pass",
  failVerdict: "fail",
  failValue: "fail",
  libraryError: "raise",
  adapterError: "raise",
  notApplicable: "held",
};

/**
 * Which other readings of the same run directory are on disk beside this one.
 *
 * Measuring and rendering are separate programs and each rendering is its own
 * command, so a directory can hold this page and no markdown at all. A page
 * that pointed at the matrix files regardless would send a reader to files that may
 * never have been written.
 *
 * Defaults to absent, which is the answer that promises nothing.
 */
export interface Companions {
  readonly markdown: boolean;
}

/**
 * A mark for the registry a library was installed from.
 *
 * Decoration, and one step to the side of what it depicts. These are the
 * mascots of the languages each registry mostly carries, and a measurement
 * records the registry rather than a language, so a library written in one
 * language and published to another's registry wears the registry's mark. The
 * registry itself is named in text on the line below, which is the half of this
 * a reader can check.
 *
 * Hidden from assistive technology for that reason: it repeats, less precisely,
 * something already written beside it.
 *
 * Total over whatever arrives rather than keyed to the ecosystems that exist
 * today. One this does not know gets a neutral mark, because a card with no
 * mark at all reads as a card missing a fact.
 */
const ECOSYSTEM_GLYPH: Record<string, string> = {
  go: "&#128057;",
  maven: "&#9749;",
  npm: "&#128230;",
  packagist: "&#128024;",
  pypi: "&#128013;",
  rubygems: "&#128142;",
};

const UNKNOWN_GLYPH = "&#9675;";

function ecosystemGlyph(ecosystem: string): string {
  return ECOSYSTEM_GLYPH[ecosystem] ?? UNKNOWN_GLYPH;
}

/**
 * A source URL as something to read rather than something to parse.
 *
 * The host and path, without the scheme, because the scheme is the same on
 * every one of them and a card is short. Anything unexpected is shown whole
 * rather than trimmed to nothing: the URL came from the container, and this
 * page does not know what shapes are possible.
 */
function sourceLabel(url: string): string {
  return url.replace(/^https:\/\//, "");
}


export function renderHtml(
  cases: readonly Case[],
  input: readonly Entry[],
  sidecar: RunSidecarState = { kind: "absent" },
  companions: Companions = { markdown: false },
): string {
  // Ordered here as well as in the command, because a column's position is the
  // one thing on this page no caption can correct: a reader takes the leftmost
  // column for the one that matters, and the page is drawn in the order the
  // entries arrive in from the roster down.
  const entries = orderEntries(input);
  const rows = roster(entries);
  const grid = conformanceGrid(cases, entries);
  const divergence = divergenceGrid(cases, entries);
  const view = coverage(cases);
  const splits = disagreements(cases, entries);
  const deltas = versionDeltas(cases, entries);
  const agreement = corpusAgreement(entries);
  const notes = caseNotes(cases);
  const matrixNames = presentVersions(cases)
    .map((version) => `<code>${matrixFileName(version)}</code>`)
    .join(" and ");
  const versions = presentVersions(cases);
  const versionOf = new Map(cases.map((c) => [c.id, c.oasVersion]));
  /**
   * The class a case row carries so the version filter can address it.
   *
   * The filter is CSS-only state: hidden radio inputs at the top of the page,
   * chip labels beside each table, and per-version rules generated below. The
   * page stays script-free, which is why the hovers are title attributes, and
   * a filter spending that property would cost more than it filters.
   */
  const rowClass = (caseId: string): string => {
    const version = versionOf.get(caseId);
    return version === undefined ? "" : ` class="vrow v-${versionSlug(version)}"`;
  };
  const filterChips = versions.length < 2
    ? ""
    : `
    <p class="vfilter"><span>show</span><label for="oas-all">all versions</label>${versions
        .map((v) => `<label for="oas-${versionSlug(v)}">${escape(v)}</label>`)
        .join("")}</p>`;

  /**
   * A case id, carrying what the case asks.
   *
   * Every table on this page identifies a case by id alone, which names the
   * question without asking it, and the corpus that has the question is a
   * separate file a reader has to go and find. The note is the corpus text, so
   * hovering says what the case does, what it varies, what it holds constant
   * and which specification text the tier rests on.
   *
   * `title` rather than anything of this page's own: the page runs no script,
   * and a tooltip built in CSS would be markup a screen reader has to be told
   * about and a printed page cannot show at all.
   */
  const caseCell = (caseId: string, tag = ""): string => {
    const note = notes.get(caseId);
    const body =
      tag === "" ? escape(caseId) : `${escape(caseId)}<span class="tag-line">${tag}</span>`;
    return note === undefined
      ? `<td class="lib-cell">${body}</td>`
      : `<td class="lib-cell noted" title="${escape(note)}">${body}</td>`;
  };

  /**
   * Marks a case the verdict column cannot answer. Explained in the tier's key.
   *
   * On its own line under the id rather than trailing it. The divergence table
   * has the width for it, and beside the id it wrapped the case name onto a
   * second line, which read as two names.
   */
  const VALUES_TAG = '<span class="tag">answered in values</span>';

  const verdictSplits = splits.filter((split) => split.kind === "verdict");
  const valueSplits = splits.filter((split) => split.kind === "value");
  // What a reader who has just arrived is shown first. Four because the block
  // has to stay shorter than the thing it points at.
  const lead = sharpestSplits(splits, 4);

  /**
   * The same reading, per specification version, because the version filter is
   * CSS and cannot recount anything. Each scope renders its own copy and the
   * filter shows one, so a count above the fold always describes the rows a
   * reader is looking at.
   */
  const scopes: readonly { slug: string; splits: readonly Disagreement[] }[] = [
    { slug: "all", splits },
    ...(versions.length < 2
      ? []
      : versions.map((version) => ({
          slug: versionSlug(version),
          splits: disagreements(
            cases.filter((testCase) => testCase.oasVersion === version),
            entries,
          ),
        }))),
  ];

  /** One span per scope, of which the filter shows exactly one. */
  const scoped = (of: (splits: readonly Disagreement[]) => string): string =>
    scopes
      .map((scope) => `<span class="vscope v-${scope.slug}">${of(scope.splits)}</span>`)
      .join("");
  const countOf = (kind: "verdict" | "value") => (found: readonly Disagreement[]) =>
    String(found.filter((split) => split.kind === kind).length);

  /**
   * A band naming the parameter location the following rows share.
   *
   * The two big grids run to dozens of rows, and the id prefix is the only
   * thing saying where one location's cases end. A band per location gives the
   * eye a place to stop without adding a column.
   */
  const locationOf = new Map(cases.map((c) => [c.id, c.dimensions.location]));
  const bandFor = (caseId: string, previousCaseId: string | undefined): string => {
    const location = locationOf.get(caseId);
    if (location === undefined || location === locationOf.get(previousCaseId ?? "")) return "";
    const label = `${location.charAt(0).toUpperCase()}${location.slice(1)} parameters`;
    // The label sits in the frozen first column rather than spanning the row:
    // a cell as wide as the table has no room to stick, so a spanned label
    // scrolls away with the columns while the ids beneath it stay put.
    return `        <tr class="band"><th scope="colgroup">${escape(label)}</th><td colspan="${String(rows.length)}"></td></tr>\n`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>openapi-crosscheck results</title>
<style>${STYLE}${versionFilterCss(versions)}</style>
</head>
<body>
<div class="wrap">
${
  versions.length < 2
    ? ""
    : `<input type="radio" name="oas" id="oas-all" class="vswitch" checked>${versions
        .map((v) => `<input type="radio" name="oas" id="oas-${versionSlug(v)}" class="vswitch">`)
        .join("")}`
}
<header>
  <p class="eyebrow">openapi-crosscheck</p>
  <h1>OpenAPI ${escape(oasVersions(cases))} request validation, measured across ${String(entries.length)} librar${entries.length === 1 ? "y" : "ies"}</h1>
  <div class="meta">
    <span><b>cases</b> ${String(view.conformance + view.divergence)}</span>
    <span><b>conformance</b> ${String(view.conformance)}</span>
    <span><b>divergence</b> ${String(view.divergence)}</span>
    <span><b>corpus</b> ${escape(agreement.digests[0]?.slice(0, 19) ?? "none")}</span>
  </div>
  <p class="lede">Every library below got the same OpenAPI documents and the same HTTP requests, and this page is what each one answered. They don't all do the same job, so what each one can be asked differs, and the page says where.</p>
${
  entries.length < 2
    ? ""
    : `  <div class="readout">
    <h2>The disagreements</h2>
    <div class="readout-counts">
      <a href="#split-verdicts"><b>${scoped(countOf("verdict"))}</b> split verdicts</a>
      <a href="#value-splits"><b>${scoped(countOf("value"))}</b> same verdict, different values</a>
    </div>
    <p class="readout-note">Cases where more than one library reached a verdict and they didn't match. A library that wasn't asked is left out rather than counted as a dissenting opinion.</p>
${
  lead.length === 0
    ? ""
    : `${scopes
        .map((scope) => {
          const rows = sharpestSplits(scope.splits, 4);
          return `    <ol class="readout-lead vscope v-${scope.slug}">
${rows
  .map(
    (split) => `      <li><a href="#${escape(split.disagreement.caseId)}"><code>${escape(
      split.disagreement.caseId,
    )}</code></a><span class="split">${String(split.accepted)} accepted &middot; ${String(
      split.rejected,
    )} rejected</span><span class="q">${escape(split.disagreement.title)}</span></li>`,
  )
  .join("\n")}
    </ol>`;
        })
        .join("\n")}
    <p class="readout-note">The evenest ones, where the libraries that answered came closest to halving. They're all in the tables below.</p>`
}
  </div>`
}
  <p class="lede">Cases come in two kinds, and the difference is the point of the whole exercise. <b>Conformance</b> cases are ones the specification settles: there's one required answer, so a different answer is a failure attributable to the library. <b>Divergence</b> cases are ones it leaves open: libraries can differ and none of them is failing, so those are reported and never scored. Conformance comes first below.</p>
  <p class="lede">This page trades depth for scannability: it leaves out the raw result behind each cell and the specification text each case rests on. The markdown reading of the same run keeps both: ${matrixNames} quotes every rule in full beside its case, and <code>libraries/&lt;name&gt;.md</code> reads each library on its own. ${
    companions.markdown
      ? "Both sit beside this file."
      : "Neither exists in this directory yet; running <code>pnpm render-md</code> on it writes them."
  } The measurement itself is <code>libraries/&lt;name&gt;.json</code>, holding what each library actually returned, and <code>corpus.json</code>, holding the questions.</p>
  ${
    agreement.agreed
      ? ""
      : `<div class="callout warn"><h3>These measurements answered different corpora</h3><p>${String(
          agreement.digests.length,
        )} distinct corpus digests are present, so a case id does not necessarily mean the same question in every column. Differences below may be differences in the questions.</p></div>`
  }
</header>

<section>
  <div class="section-head">
    <h2>The roster</h2>
    <p>What each library does for itself, and what its caller supplies. Nothing here is ranked: owning fewer stages is a different shape. The source link on a card is where that library's container says its source lives, which is a claim by whoever wrote the container and something this run never checked.</p>
  </div>
${stageLegend()}
  <div class="libs">
${rows
  .map(
    (row) => `    <article class="lib">
      <div class="lib-head">
        <span class="lib-glyph" title="installed from ${escape(row.ecosystem)}" aria-hidden="true">${ecosystemGlyph(row.ecosystem)}</span>
        <span class="lib-name">${escape(row.label)}</span>
        <span class="lib-ver">${escape(row.library)} ${escape(row.libraryVersion)} &middot; ${escape(row.ecosystem)}</span>
        <span class="lib-oas" title="what this container declares its library accepts; the two-sided probes of every claim are in capabilities.md">OpenAPI ${escape(row.oasVersions.join(", "))}</span>
      </div>
      <div class="strip">
${STAGE_SLOTS.map(
  (slot, index) =>
    `        <div class="seg${row.owns[index] === true ? " owned" : ""}" title="${escape(`${slot.title}. ${slot.description}`)}"><div class="bar"></div><span class="lbl">${escape(slot.title)}</span></div>`,
).join("\n")}
      </div>
      <p class="lib-note"><code>${escape(row.configurationId)}</code> &middot; ${escape(row.imageId.slice(0, 19))}</p>
      ${
        row.localBuild === null
          ? ""
          : `<p class="lib-local">Installed from ${escape(row.localBuild)}, so the version above is the release this build was branched from rather than the code that answered.</p>`
      }
      ${
        row.librarySource === null
          ? ""
          : `<p class="lib-src"><a href="${escape(row.librarySource)}" rel="noreferrer noopener">${escape(sourceLabel(row.librarySource))}</a></p>`
      }
    </article>`,
  )
  .join("\n")}
  </div>
</section>

<section>
  <div class="section-head">
    <h2>The words the tables use</h2>
    <p>Six of them, and the rest of the page assumes them. If you already know what an adapter and a stage are, scroll past.</p>
  </div>
  <dl class="terms">
    <dt>case</dt><dd>One document, one request, and one question about how the specification says that request should be read. There are ${String(view.conformance + view.divergence)} of them, and the whole set is the corpus.</dd>
    <dt>library</dt><dd>A request validator someone published. Nothing here compares them on speed, size or anything but what they answered.</dd>
    <dt>adapter</dt><dd>How one library gets asked. Each library is installed in a container of its own with a small program that speaks this harness's protocol on one side and that library's own API on the other. Nothing above that layer knows which library is running, which is what keeps the questions identical.</dd>
    <dt>configuration</dt><dd>How one library was constructed and driven: which published call the adapter made, with what options, and which locations it was handed already split. A library rejecting everything may be misconfigured rather than strict, so every result carries one. Each card below names its own, and <code>libraries/&lt;name&gt;.json</code> writes it out in full.</dd>
    <dt>measurement</dt><dd>One library's answers to the whole corpus, stored on its own and readable without the others.</dd>
    <dt>stage</dt><dd>A step of the work: matching the route, splitting the query string, applying a style, checking the schema. A library performs some of these and expects its caller to have done the rest, and a case is only put to a library that performs the step that case is about.</dd>
  </dl>
</section>

<section>
  <div class="section-head">
    <h2>Conformance</h2>
    <p><b>What the specification settles.</b> ${String(view.conformance)} cases where it requires one answer, so a different answer is a failure attributable to the library. Every case is listed against every measurement. Nothing is totalled: measurements are asked different numbers of cases, so a count per measurement would carry its own denominator and read as a rank against denominators it doesn't share.</p>${filterChips}
  </div>
  <div class="scroll">
    <table>
      <thead><tr><th>case</th>${rows.map((row) => `<th>${escape(row.label)}</th>`).join("")}</tr></thead>
      <tbody>
${grid
  .map(
    (line, index) =>
      `${bandFor(line.caseId, grid[index - 1]?.caseId)}        <tr${rowClass(line.caseId)}>${caseCell(line.caseId)}${line.outcomes
        .map(
          (outcome) =>
            `<td class="chip-cell"><span class="chip ${OUTCOME_CLASS[outcome]}">${escape(OUTCOME_LABEL[outcome])}</span></td>`,
        )
        .join("")}</tr>`,
  )
  .join("\n")}
      </tbody>
    </table>
  </div>
  <div class="callout">
    <h3>Reading a cell</h3>
    <p>A case id with a dotted underline carries the corpus entry it came from. Hover it: the note opens with a plain line saying what the case sends and what it's watching for, then the request itself, the expected verdict, and the argument for it. The rules are named at the end, and ${matrixNames} quotes them in full. The same hover works in every table on this page.</p>
    <dl class="stages">
${CONFORMANCE_OUTCOMES.map(
  (outcome) =>
    `      <dt><span class="chip ${OUTCOME_CLASS[outcome]}">${escape(OUTCOME_LABEL[outcome])}</span></dt><dd>${escape(OUTCOME_NOTE[outcome])}</dd>`,
).join("\n")}
    </dl>
  </div>
</section>

<section>
  <div class="section-head">
    <h2>Divergence</h2>
    <p><b>What the specification leaves open.</b> ${String(view.divergence)} cases where it requires no particular answer, so libraries can differ here and none of them is failing. With no expected answer there's nothing to fail: the table reports what each measurement returned, including the cases they all answered alike, which is a finding of its own about a question the specification left open.</p>${filterChips}
    <p>Each cell holds two things: the verdict that library reached, and under it the values it handed back, or a note where it hands none.</p>
  </div>
  <div class="scroll">
    <table>
      <thead><tr><th>case</th>${rows.map((row) => `<th>${escape(row.label)}</th>`).join("")}</tr></thead>
      <tbody>
${divergence
  .map(
    (line, index) =>
      `${bandFor(line.caseId, divergence[index - 1]?.caseId)}        <tr${rowClass(line.caseId)}>${caseCell(line.caseId, line.answeredInValues ? VALUES_TAG : "")}${line.answers
        .map(
          (answer) =>
            `<td class="w"><span class="verdict">${escape(answer.verdict)}</span><code>${escape(answer.values)}</code></td>`,
        )
        .join("")}</tr>`,
  )
  .join("\n")}
      </tbody>
    </table>
  </div>
  <div class="callout">
    <h3>Reading a cell</h3>
    <p>Each cell holds two separate results: the verdict the library reached, and what it handed back.</p>
    <dl class="stages">
      <dt>accepted / rejected</dt><dd>The verdict the library reached on the request.</dd>
      <dt>raised, no verdict</dt><dd>It threw instead of answering, so an application would have seen an exception. Attributable to the library, and a different thing from a rejection.</dd>
      <dt>not asked</dt><dd>It was never given this case, because it doesn't perform the stage the case probes. The reason is on the cell and in <code>capabilities.md</code>.</dd>
      <dt>harness error</dt><dd>An error in the adapter or the harness rather than an answer from the library.</dd>
      <dt><code>{"p":"blue"}</code></dt><dd>The values the library handed back, as it returned them. The vantage they were read from is recorded with every answer in <code>libraries/&lt;slug&gt;.json</code>, because a value handed to a handler and a value read from a validator are different observations.</dd>
      <dt>not exposed by this library</dt><dd>It reached a verdict, and publishes no call that returns deserialized values. That's a fact about the library rather than about this request.</dd>
      <dt>none reached</dt><dd>It exposes values, and produced none here.</dd>
    </dl>
    <p>${divergence.some((line) => line.answeredInValues) ? `A case marked <span class="tag">answered in values</span> is one the verdict can't carry: every reading of the specification accepts the request, and what separates them is what comes back. A library exposing no values reaches a verdict on such a case and answers nothing by it, so read those rows down the value line alone.` : `No case in this run is marked <span class="tag">answered in values</span>, which would mean a case the verdict can't carry.`}</p>
  </div>
</section>

${deltas
  .map(
    (delta) => `<section>
  <div class="section-head">
    <h2>What moved: ${escape(delta.library)}, ${escape(delta.from)} to ${escape(delta.to)}</h2>
    <p>${delta.moved.length === 0 ? "No conformance case changed outcome." : `${String(delta.moved.length)} conformance case${delta.moved.length === 1 ? "" : "s"} changed outcome.`}</p>
  </div>
${
  delta.moved.length === 0
    ? ""
    : `  <div class="scroll">
    <table>
      <thead><tr><th>case</th><th>${escape(delta.from)}</th><th>${escape(delta.to)}</th></tr></thead>
      <tbody>
${delta.moved
  .map(
    (move) =>
      `        <tr${rowClass(move.caseId)}>${caseCell(move.caseId)}<td><span class="chip ${OUTCOME_CLASS[move.before]}">${escape(OUTCOME_LABEL[move.before])}</span></td><td><span class="chip ${OUTCOME_CLASS[move.after]}">${escape(OUTCOME_LABEL[move.after])}</span></td></tr>`,
  )
  .join("\n")}
      </tbody>
    </table>
  </div>`
}
</section>`,
  )
  .join("\n")}

<section>
  <div class="section-head">
    <h2>About the corpus, not the libraries</h2>
    <p>The tables above are the results: what each library answered, case by case. The three below are about the questions instead. Two summarise where the answers parted company, which is a reading of the same results rather than a new measurement. The third is what the corpus does and doesn't ask, which stays true of this list of cases whoever runs it.</p>
  </div>
</section>

<section>
  <div class="section-head">
    <h2>Where the answers differed</h2>
    <p>Cases where more than one measurement reached a verdict and they didn't match. A measurement that wasn't asked is left out rather than counted as a dissenting opinion.</p>${filterChips}
  </div>
  ${splitTable(
    "Split verdicts",
    "split-verdicts",
    scoped(countOf("verdict")),
    "One accepted where another rejected.",
    verdictSplits,
    caseCell,
    rowClass,
    entries.length > 1,
  )}
  ${splitTable(
    "Same verdict, different values",
    "value-splits",
    scoped(countOf("value")),
    "Every measurement agreed on the verdict and handed its caller something different. This is the disagreement a verdict column can't show.",
    valueSplits,
    caseCell,
    rowClass,
    entries.length > 1,
  )}
</section>

<section>
  <div class="section-head">
    <h2>Coverage of the corpus</h2>
    <p>Enumerated from the specification rather than from the corpus, so an empty cell is a case nobody has written.</p>
  </div>
  <div class="maps">
    <div class="map">
      <h3>style surface</h3>
      <p class="q">Location, style, explode and schema combinations.</p>
      <dl><dt>covered</dt><dd>${String(view.styleCovered)}</dd><dt>defined</dt><dd>${String(view.styleDefined)}</dd></dl>
    </div>
    <div class="map">
      <h3>content surface</h3>
      <p class="q">Location, media type and schema combinations.</p>
      <dl><dt>covered</dt><dd>${String(view.contentCovered)}</dd><dt>defined</dt><dd>${String(view.contentDefined)}</dd></dl>
    </div>
    <div class="map">
      <h3>declaration form</h3>
      <p class="q">The two ways the specification defines.</p>
      <dl>${view.byDeclaration.map((entry) => `<dt>${escape(entry.declaration)}</dt><dd>${String(entry.cases)}</dd>`).join("")}</dl>
    </div>
    <div class="map">
      <h3>declared value type</h3>
      <p class="q">What the schemas ask for. A zero is a type nothing probes.</p>
      <dl>${view.byType.map((entry) => `<dt>${escape(entry.type)}</dt><dd>${String(entry.declaredBy.length)}</dd>`).join("")}</dl>
    </div>
    <div class="map">
      <h3>probed stage</h3>
      <p class="q">Which pipeline stage each case exists to test.</p>
      <dl>${view.byStage.map((entry) => `<dt>${escape(entry.stage)}</dt><dd>${String(entry.conformance + entry.divergence)}</dd>`).join("")}</dl>
    </div>
    <div class="map">
      <h3>probe axis</h3>
      <p class="q">What each case varies away from canonical.</p>
      <dl>${view.byAxis.map((entry) => `<dt>${escape(entry.axis)}</dt><dd class="${entry.cases === 0 ? "thin" : ""}">${String(entry.cases)}</dd>`).join("")}</dl>
    </div>
  </div>
</section>

${provenance(sidecar)}
</div>
</body>
</html>
`;
}

/**
 * What the segments of a roster strip mean.
 *
 * Ahead of the libraries rather than under them, because the strip is unreadable
 * until it is read once: a reader who does not know what `split: cookie` is
 * cannot tell a library that leaves the stage to its caller from one that
 * performs it badly, and those are opposite facts. The stages come from
 * `STAGE_SLOTS`, the same list the strips are drawn from, so a stage added to
 * the pipeline appears here without anyone remembering to add it.
 *
 * The two swatches are the legend for the strip itself. A filled segment and an
 * empty one are the only marks on it, and nothing else on the page says which
 * is which.
 */
/**
 * The specification version(s) the rendered corpus cites, from the cases
 * rather than from anyone's assumption. Every case names the OAS version its
 * question is asked of, and a corpus mixing versions is legal, so the heading
 * lists what is actually present instead of hardcoding today's answer.
 */
function oasVersions(cases: readonly Case[]): string {
  const versions = [...new Set(cases.map((c) => c.oasVersion))].sort();
  return versions.join(" and ");
}

/**
 * The rules that make the version filter work, generated from the versions
 * this run holds. `#oas-<slug>:checked` reaches the tables through the general
 * sibling combinator, because the inputs are direct children of `.wrap` and
 * every section is their sibling. Selecting a version hides the other
 * versions' rows; the labels for the active choice pick up the chip styling.
 */
function versionFilterCss(versions: readonly OasVersion[]): string {
  if (versions.length < 2) return "";
  // A scoped element renders once per version and once for the whole corpus,
  // and the filter shows the one matching it. That is how a count stays true
  // under a filter that can hide rows and cannot recount them.
  const rules: string[] = [
    `#oas-all:checked ~ * .vscope:not(.v-all){display:none}`,
    ...versions.map(
      (version) =>
        `#oas-${versionSlug(version)}:checked ~ * .vscope:not(.v-${versionSlug(version)}){display:none}`,
    ),
  ];
  for (const version of versions) {
    const slug = versionSlug(version);
    const others = versions.filter((other) => other !== version);
    for (const other of others) {
      rules.push(`#oas-${slug}:checked ~ section tr.v-${versionSlug(other)}{display:none}`);
    }
    rules.push(
      `#oas-${slug}:checked ~ section .vfilter label[for="oas-${slug}"]{background:var(--accent);color:var(--paper);border-color:var(--accent)}`,
    );
  }
  rules.push(
    `#oas-all:checked ~ section .vfilter label[for="oas-all"]{background:var(--accent);color:var(--paper);border-color:var(--accent)}`,
  );
  return `\n${rules.join("\n")}\n`;
}

function stageLegend(): string {
  return `  <div class="callout legend">
    <h3>What the segments mean</h3>
    <p>A request validator is a pipeline, and a library performs some of it and requires its caller to have done the rest. Each library below carries one segment per stage.</p>
    <p class="keys"><span class="key"><span class="swatch owned"></span>the library performs this stage</span><span class="key"><span class="swatch"></span>its caller supplies it, and the specification rules governing it are the caller's to get right</span></p>
    <dl class="stages">
${STAGE_SLOTS.map(
  (slot) =>
    `      <dt>${escape(slot.title)}</dt><dd>${escape(slot.description)}</dd>`,
).join("\n")}
    </dl>
    <p><code>styleDeserialization</code> and <code>contentDeserialization</code> are the two ways a parameter's serialization can be specified, and the specification requires each parameter to use exactly one. They are separate segments because a library can perform one and not the other. Splitting is one segment per location, because a library can recover path parameters from a target and still require the query string to arrive already split.</p>
  </div>`;
}

/**
 * How old this page is, and how much of that the run directory can actually
 * say.
 *
 * On its own surface because a reader evaluating a table needs
 * to know when it was produced before reading it. The wording separates two
 * facts a reader would otherwise merge: when the run in this directory
 * happened, which the sidecar records, and when these answers were measured,
 * which nothing records, because no field ties a sidecar to a measurement.
 *
 * A dirty harness is published as plainly as a clean one. A revision with
 * uncommitted changes on top identifies nothing, and a reader who cannot see
 * that would take the revision for a reproducible starting point.
 */
function provenance(state: RunSidecarState): string {
  if (state.kind === "absent") {
    return `<div class="callout warn">
  <h3>Nothing records when this run happened</h3>
  <p>A finished run writes a <code>run.json</code> beside its answers saying when it started and what produced it. This directory has none, so either the run died before finishing or that file was not kept. Each library still carries the version and the image id it answered from, on its card above.</p>
</div>`;
  }
  if (state.kind === "unreadable") {
    return `<div class="callout warn">
  <h3>The record of this run could not be read</h3>
  <p>This directory has a <code>run.json</code> and this page cannot read it, so nothing here says when the run happened or what produced it. Each library still carries the version and the image id it answered from, on its card above.</p>
</div>`;
  }

  const { sidecar } = state;
  const facts: [string, string][] = [
    ["run started", sidecar.startedAt ?? "not recorded"],
    ["harness", sidecar.harnessRevision?.slice(0, 12) ?? "not recorded"],
    [
      "harness dirty",
      sidecar.harnessDirty === null ? "not recorded" : sidecar.harnessDirty ? "yes" : "no",
    ],
    ["corpus", sidecar.corpusDigest ?? "not recorded"],
    ["node", sidecar.node ?? "not recorded"],
    ["platform", sidecar.platform ?? "not recorded"],
  ];

  return `<div class="callout">
  <h3>How this run was produced</h3>
  <p>Written by the run itself into <code>run.json</code>, beside the answers.</p>
  <dl class="facts">${facts
    .map(([term, value]) => `<dt>${escape(term)}</dt><dd>${escape(value)}</dd>`)
    .join("")}</dl>
  ${sidecar.harnessDirty === null ? "" : "<p>A dirty harness had uncommitted changes on top of that revision, so the revision alone doesn't identify the code that ran.</p>"}
  <p>The corpus digest is of every field of every case, so it moves when a case is reworded as well as when one is rewritten, and two runs either side of a typo fix no longer compare. It is written when a run is measured and never rechecked, so it names the corpus the harness held at the time rather than proving the <code>corpus.json</code> in this directory is still that one.</p>
  <p><code>run.json</code> records the run. It names no measurement file and no measurement file names it, so nothing ties what is above to any particular library's answers: a measurement copied into this directory from another run would still be listed under it.</p>
  <p>It also says when these answers were recorded rather than whether they're still right. Only running the containers again settles that, and no file in this directory records when that last happened.</p>
</div>`;
}

function splitTable(
  heading: string,
  anchor: string,
  /**
   * The count as markup rather than a number, because the version filter is CSS
   * and a heading holding one number would go on stating the whole-corpus total
   * over a table showing one version's rows.
   */
  count: string,
  blurb: string,
  splits: readonly {
    caseId: string;
    title: string;
    tier: string;
    answers: readonly { label: string; verdict: string; values: string }[];
  }[],
  caseCell: (caseId: string) => string,
  rowClass: (caseId: string) => string,
  comparable: boolean,
): string {
  if (splits.length === 0) {
    // "Nothing to compare" and "compared and found nothing" are different
    // facts, and only one of them is about the libraries. A run holding one
    // measurement is the ordinary path rather than a comparison that came back
    // empty, so it says so.
    return `<div class="callout" id="${anchor}"><h3>${escape(heading)}</h3><p>${
      comparable
        ? "None in this run."
        : "This run holds one measurement, so there's nothing for it to differ from."
    }</p></div>`;
  }
  return `<div class="callout" id="${anchor}"><h3>${escape(heading)} &middot; ${count}</h3><p>${escape(blurb)}</p></div>
  <div class="scroll">
    <table>
      <thead><tr><th>case</th><th>tier</th><th>answers</th></tr></thead>
      <tbody>
${splits
  .map(
    (split) =>
      `        <tr id="${escape(split.caseId)}"${rowClass(split.caseId)}>${caseCell(split.caseId)}<td>${escape(split.tier)}</td><td class="w">${split.answers
        .map(
          (answer) =>
            `<span class="ans"><b>${escape(answer.label)}</b> ${escape(answer.verdict)} <code>${escape(answer.values)}</code></span>`,
        )
        .join(" ")}</td></tr>`,
  )
  .join("\n")}
      </tbody>
    </table>
  </div>`;
}

/**
 * Case ids, labels and library output all reach the page as text.
 *
 * A library's raw output is not this repository's text, and a report that
 * pasted it into markup unescaped would let a measured library decide what the
 * page contains.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
:root{--paper:#f4f6f7;--surface:#fff;--surface-2:#eceff1;--ink:#161b21;--muted:#5b6672;--faint:#8a94a0;--rule:#dde2e6;--accent:#0b6e7f;--accent-soft:#d9ebee;--pass:#2f6f52;--pass-soft:#dbeade;--fail:#a53d27;--fail-soft:#f4ddd7;--held:#7d8794;--held-soft:#e4e8eb;--raise:#8a5a1f;--raise-soft:#f3e6d2;--sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#0e1216;--surface:#161b21;--surface-2:#1d242c;--ink:#e6ebf0;--muted:#97a1ad;--faint:#6d7883;--rule:#252d36;--accent:#46a9ba;--accent-soft:#16333a;--pass:#6cb190;--pass-soft:#1a3229;--fail:#dd8770;--fail-soft:#38211a;--held:#78828f;--held-soft:#222a32;--raise:#d3a45f;--raise-soft:#33260f}}
:root[data-theme="dark"]{--paper:#0e1216;--surface:#161b21;--surface-2:#1d242c;--ink:#e6ebf0;--muted:#97a1ad;--faint:#6d7883;--rule:#252d36;--accent:#46a9ba;--accent-soft:#16333a;--pass:#6cb190;--pass-soft:#1a3229;--fail:#dd8770;--fail-soft:#38211a;--held:#78828f;--held-soft:#222a32;--raise:#d3a45f;--raise-soft:#33260f}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
/* The column is as wide as the window, so a wide window shows more of a table
   rather than more margin, and 63rem is the floor rather than the cap it used
   to be: below that the grids start losing columns to compression, so the page
   scrolls instead. Prose keeps a measure of its own, because a line of text 200
   characters long is unreadable at any window width and the space is for the
   tables. */
.wrap{min-width:63rem;margin:0 auto;padding:clamp(2rem,5vw,4rem) clamp(1rem,3vw,3rem) 5rem;display:flex;flex-direction:column;gap:3.25rem}
h1,header p,.section-head p,.callout p,.callout dd,.map .q{max-width:74ch}
/* A screen this size cannot show the floor at all. The tables keep their own
   scroll, and the surrounding page compresses to the viewport. */
@media (max-width:48rem){.wrap{min-width:0}}
.eyebrow{font-family:var(--mono);font-size:.7rem;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);margin:0 0 .75rem}
h1{font-size:clamp(1.9rem,4.5vw,2.55rem);line-height:1.15;letter-spacing:-.022em;font-weight:620;margin:0 0 .85rem;text-wrap:balance}
h2{font-size:1.3rem;font-weight:600;margin:0 0 .35rem}
h3{font-size:1rem;font-weight:600;margin:0 0 .3rem}
p{margin:0 0 .9rem}p:last-child{margin-bottom:0}
section{display:flex;flex-direction:column;gap:1.1rem}
.section-head{border-top:2px solid var(--ink);padding-top:.9rem}
.section-head p{color:var(--muted);font-size:.94rem;margin:0}
.lib-local{margin:.35rem 0 0;font-size:.72rem;color:var(--raise)}
.lib-src{margin:.35rem 0 0;font-family:var(--mono);font-size:.72rem;overflow-wrap:anywhere}
.lib-src a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-soft)}
.lib-src a:hover{border-bottom-color:var(--accent)}
.lede{color:var(--muted);font-size:.9rem;line-height:1.6;margin:1rem 0 0}
.meta{display:flex;flex-wrap:wrap;gap:.45rem 1.5rem;font-family:var(--mono);font-size:.76rem;color:var(--faint);padding-top:1rem;border-top:1px solid var(--rule)}
.meta b{color:var(--muted);font-weight:500}
.readout{margin-top:1.4rem;padding:1.05rem 1.15rem 1.15rem;background:var(--surface);border:1px solid var(--rule);border-radius:3px}
.readout h2{font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 .8rem;font-weight:600}
.readout-counts{display:flex;flex-wrap:wrap;gap:.5rem 2rem}
.readout-counts a{display:flex;align-items:baseline;gap:.45rem;color:var(--muted);text-decoration:none;font-size:.85rem}
.readout-counts a:hover{color:var(--fg)}
.readout-counts b{font-family:var(--mono);font-size:1.5rem;font-weight:600;color:var(--fg);line-height:1.1}
.readout-note{color:var(--faint);font-size:.78rem;line-height:1.55;margin:.75rem 0 0}
.readout-lead{list-style:none;margin:.9rem 0 0;padding:.85rem 0 0;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:.5rem}
.readout-lead li{display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem .7rem;font-size:.8rem}
.readout-lead code{font-size:.78rem}
.readout-lead a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
.readout-lead a:hover{border-bottom-color:var(--accent)}
.readout-lead .split{font-family:var(--mono);font-size:.74rem;color:var(--muted);white-space:nowrap}
.readout-lead .q{color:var(--faint);flex:1 1 14rem;min-width:0}
.libs{display:flex;flex-direction:column;gap:1.1rem}
.lib{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1.05rem 1.15rem 1.2rem}
.lib-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .9rem;margin-bottom:.85rem}
.lib-glyph{flex:none;font-size:.95rem;line-height:1;align-self:center}
.lib-name{font-family:var(--mono);font-size:.92rem;font-weight:600}
.lib-ver{font-family:var(--mono);font-size:.74rem;color:var(--faint)}
.strip{display:flex;gap:3px}
.seg{flex:1;min-width:0}
.seg .bar{height:.55rem;border-radius:1px;background:var(--held-soft);border:1px solid var(--rule)}
.seg.owned .bar{background:var(--accent);border-color:var(--accent)}
.seg .lbl{display:block;font-family:var(--mono);font-size:.6rem;color:var(--faint);margin-top:.4rem;overflow-wrap:anywhere}
.seg.owned .lbl{color:var(--muted)}
.lib-oas{font-family:var(--mono);font-size:.72rem;color:var(--accent);border:1px solid var(--accent-soft);border-radius:2px;padding:.06rem .4rem;cursor:help}
.lib-note{margin-top:.9rem;font-size:.8rem;color:var(--faint);font-family:var(--mono)}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.87rem;background:var(--surface);border:1px solid var(--rule);border-radius:3px}
th,td{text-align:left;padding:.55rem .75rem;border-bottom:1px solid var(--rule);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
thead th{font-family:var(--mono);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:500;background:var(--surface-2)}
td.lib-cell{font-family:var(--mono);font-size:.8rem}
/* The case id holds its position while the library columns scroll under it.
   Without this a reader four columns into a wide grid is looking at a row of
   chips with nothing on screen saying which case they answer. The background is
   explicit because a sticky cell is painted over the cells passing beneath it,
   and the header keeps its own so the corner does not go transparent. */
th:first-child,td:first-child{position:sticky;left:0;z-index:1;background:var(--surface);box-shadow:1px 0 0 var(--rule)}
thead th:first-child{z-index:2;background:var(--surface-2)}
td.noted{cursor:help;text-decoration:underline dotted var(--faint);text-underline-offset:.25rem}
tr.band th,tr.band td{background:var(--surface-2);padding:.4rem .75rem}
tr.band th{font-family:var(--mono);font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.tag-line{display:block;margin-top:.3rem}
.tag{display:inline-block;font-family:var(--sans);font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;padding:.05rem .35rem;border-radius:2px;background:var(--accent-soft);color:var(--accent);vertical-align:.08em;text-decoration:none;white-space:nowrap}
td.chip-cell{text-align:left}
.verdict{display:block;font-family:var(--mono);font-size:.76rem;color:var(--ink);margin-bottom:.15rem}
td.w{white-space:normal;color:var(--muted);font-size:.85rem}
/* One library per line. Run together, a row of six answers reads as one
   sentence, and the whole point of these two tables is comparing them. */
.ans{display:block}
.ans + .ans{margin-top:.3rem}
.ans b{font-family:var(--mono);font-weight:600;color:var(--ink)}
.chip{display:inline-block;font-family:var(--mono);font-size:.72rem;padding:.1rem .42rem;border-radius:2px;min-width:2rem;text-align:center}
.chip.pass{background:var(--pass-soft);color:var(--pass)}
.chip.fail{background:var(--fail-soft);color:var(--fail)}
.chip.held{background:var(--held-soft);color:var(--held)}
.chip.raise{background:var(--raise-soft);color:var(--raise)}
.vswitch{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0)}
.vfilter{display:flex;align-items:baseline;gap:.45rem;margin:.6rem 0 0;font-size:.8rem;color:var(--faint)}
.vfilter label{font-family:var(--mono);font-size:.72rem;padding:.12rem .55rem;border:1px solid var(--rule);border-radius:2px;background:var(--surface);color:var(--muted);cursor:pointer}
.vfilter label:hover{border-color:var(--accent)}
.callout{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);border-radius:3px;padding:1rem 1.2rem}
.callout.warn{border-left-color:var(--fail)}
.callout p{font-size:.92rem;color:var(--muted)}
.legend .keys{display:flex;flex-wrap:wrap;gap:.35rem 1.4rem;font-size:.85rem;color:var(--muted)}
.legend .key{display:flex;align-items:baseline;gap:.45rem}
.legend .swatch{flex:none;width:1.6rem;height:.55rem;border-radius:1px;background:var(--held-soft);border:1px solid var(--rule)}
.legend .swatch.owned{background:var(--accent);border-color:var(--accent)}
.stages{margin:.9rem 0;display:grid;grid-template-columns:auto 1fr;gap:.3rem .9rem}
.stages dt{font-family:var(--mono);font-size:.76rem;color:var(--ink);overflow-wrap:anywhere}
.stages dd{margin:0;font-size:.88rem;color:var(--muted)}
@media (max-width:34rem){.stages{grid-template-columns:1fr;gap:.1rem}.stages dd{margin-bottom:.5rem}}
.terms{margin:1.1rem 0;display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;max-width:74ch}
.terms dt{font-family:var(--mono);font-size:.78rem;color:var(--accent);padding-top:.12rem}
.terms dd{margin:0;font-size:.9rem;line-height:1.55;color:var(--muted)}
@media (max-width:34rem){.terms{grid-template-columns:1fr;gap:.1rem}.terms dd{margin-bottom:.6rem}}
.facts{margin:0 0 .9rem;display:grid;grid-template-columns:auto 1fr;gap:.3rem .9rem;font-family:var(--mono);font-size:.78rem}
.facts dt{color:var(--faint)}
.facts dd{margin:0;color:var(--ink);overflow-wrap:anywhere}
.maps{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}
.map{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.1rem}
.map h3{font-family:var(--mono);font-size:.78rem;margin-bottom:.2rem}
.map .q{font-size:.82rem;color:var(--faint);margin:0 0 .85rem}
.map dl{margin:0;display:grid;grid-template-columns:1fr auto;gap:.28rem .75rem}
.map dt{font-family:var(--mono);font-size:.74rem;color:var(--muted);overflow-wrap:anywhere}
.map dd{margin:0;font-family:var(--mono);font-size:.74rem;font-variant-numeric:tabular-nums;text-align:right}
.map dd.thin{color:var(--fail)}
code{font-family:var(--mono);font-size:.86em;background:var(--surface-2);padding:.08em .32em;border-radius:2px}
`;
