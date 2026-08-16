import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Case, ConformanceCase } from "../../src/types/case";
import type { LibraryMeasurement } from "../../src/types/measurement";
import { readRun } from "../../src/report/read";
import { renderHtml } from "../../src/report/html";
import { score } from "../../src/report/score";
import {
  STAGE_SLOTS,
  caseNote,
  compareLibraryNames,
  coverage,
  disagreements,
  type Entry,
} from "../../src/report/view";

/**
 * What the page has to contain, counted rather than eyeballed.
 *
 * The markdown is checked by rebuilding it and comparing bytes, which works
 * because it is committed. The page is not committed, so there is nothing to
 * compare it against, and it went unchecked entirely: it rendered 13 of 20
 * divergence cases and 45 of 56 conformance cases for as long as it existed,
 * because a section that looked like the divergence tier was a filter across
 * both tiers. `pnpm check` had nothing to say about that.
 *
 * So the assertions here are the ones a count can make and prose cannot. Every
 * case in the corpus reaches the tier it belongs to, and the outcomes the page
 * draws are the outcomes the scorer computed, in the same numbers. A missing
 * section, a filter left in place of a tier, a truncated grid and a mislabelled
 * cell all move one of those numbers.
 *
 * What they cannot say is whether the page reads well, whether its prose is
 * true, or whether a cell is in the right column. Those stay a person's job.
 * The bug this file exists for was none of those: it was a whole tier absent
 * from a page that looked complete.
 */

const reportDir = fileURLToPath(new URL("../../report", import.meta.url));
const run = readRun(reportDir);

/**
 * Labels rather than the roster's, because the labelling rules are the CLI's
 * and this file is about what reaches the page.
 */
const entries: Entry[] = run.measurements.map((measurement) => ({
  label: measurement.library,
  measurement,
}));

const html = renderHtml(run.cases, entries);

/** One tier's markup, from its heading to the next one. */
function section(heading: string): string {
  const start = html.indexOf(`<h2>${heading}</h2>`);
  if (start === -1) throw new Error(`the page has no ${heading} section`);
  const next = html.indexOf("<h2>", start + heading.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function casesIn(tier: Case["tier"]): readonly Case[] {
  return run.cases.filter((testCase) => testCase.tier === tier);
}

describe("every case the corpus asks reaches the page", () => {
  // Counted per tier, because the failure this catches put divergence cases in
  // a section that was filtering both tiers. Presence somewhere on the page was
  // true of thirteen of them while the tier itself was missing.
  it.each([
    ["Conformance", "conformance"],
    ["Divergence", "divergence"],
  ] as const)("gives every %s case a row of its own", (heading, tier) => {
    const rows = count(section(heading), '<td class="lib-cell');
    expect(rows).toBe(casesIn(tier).length);
  });

  it("gives every measurement a column in both tiers", () => {
    for (const heading of ["Conformance", "Divergence"]) {
      const header = section(heading);
      for (const entry of entries) expect(header).toContain(`<th>${entry.label}</th>`);
    }
  });
});

describe("the outcomes drawn are the outcomes scored", () => {
  /**
   * The same join the page makes, made again from the scorer rather than from
   * the view the page uses.
   *
   * Not independent of how an outcome is decided, which `view.test.ts` covers.
   * It is independent of the page, which is the part nothing else looks at: a
   * grid that drops cells, renders the wrong one, or mislabels an outcome moves
   * a number here.
   */
  function expectedLabels(): Map<string, number> {
    const tally = new Map<string, number>();
    const conformance = run.cases.filter((c): c is ConformanceCase => c.tier === "conformance");
    for (const testCase of conformance) {
      for (const { measurement } of entries) {
        const outcome = answerFor(measurement, testCase.id);
        const label = LABELS[outcome === undefined ? "notApplicable" : score(testCase, outcome)];
        tally.set(label, (tally.get(label) ?? 0) + 1);
      }
    }
    return tally;
  }

  it("draws one chip per case per measurement, labelled as scored", () => {
    // The table alone. The key below it draws one chip of every kind, and
    // counting those would add a phantom result per outcome.
    const conformance = section("Conformance").split("</table>")[0] ?? "";
    const drawn = new Map<string, number>();
    for (const [, label] of conformance.matchAll(/<span class="chip [a-z]+">([^<]*)<\/span>/g)) {
      drawn.set(label ?? "", (drawn.get(label ?? "") ?? 0) + 1);
    }
    expect(Object.fromEntries(drawn)).toEqual(Object.fromEntries(expectedLabels()));
  });

  it("explains every chip it can draw, one line each", () => {
    // Generated from the outcome list rather than written as prose, because the
    // paragraph it replaced explained four of the seven and a reader met the
    // other three with no key at all.
    const key = section("Conformance").split("</table>")[1] ?? "";
    for (const label of new Set(Object.values(LABELS))) {
      expect(key).toContain(`>${label}</span></dt>`);
    }
  });

  it("draws a cell for every pair, so no measurement is quietly short a case", () => {
    const drawn = count(section("Conformance"), '<td class="chip-cell">');
    expect(drawn).toBe(casesIn("conformance").length * entries.length);
  });
});

describe("a count under the version filter counts what the filter shows", () => {
  // The filter is CSS: it hides rows and cannot recount anything. So every
  // count renders once per version and once for the whole corpus, and the
  // filter shows the matching one. A single number above the fold would go on
  // stating the whole-corpus total over one version's rows.
  const versions = [...new Set(run.cases.map((testCase) => testCase.oasVersion))].sort();

  /** The markup between two landmarks, so an assertion names one site. */
  function between(from: string, to: string): string {
    const start = html.indexOf(from);
    if (start === -1) throw new Error(`the page has no ${from}`);
    return html.slice(start, html.indexOf(to, start));
  }

  it("renders a variant per version beside the whole-corpus one", () => {
    for (const version of versions) {
      const slug = `v-oas${version.replace(".", "")}`;
      expect(html).toContain(`<span class="vscope ${slug}">`);
    }
    expect(html).toContain('<span class="vscope v-all">');
  });

  it("gives each count its own number per version, at every place it appears", () => {
    // Sliced per site rather than searched across the page: the same numbers
    // appear in the readout and in each table heading, so a whole-page search
    // passes while any one of them still states the corpus total.
    const sites = [
      { name: "readout: split verdicts", markup: between('<a href="#split-verdicts">', "</a>"), kind: "verdict" },
      { name: "readout: value splits", markup: between('<a href="#value-splits">', "</a>"), kind: "value" },
      { name: "table: split verdicts", markup: between('id="split-verdicts"', "</h3>"), kind: "verdict" },
      { name: "table: value splits", markup: between('id="value-splits"', "</h3>"), kind: "value" },
    ] as const;

    for (const site of sites) {
      for (const version of versions) {
        const slug = `oas${version.replace(".", "")}`;
        const scoped = disagreements(
          run.cases.filter((testCase) => testCase.oasVersion === version),
          entries,
        );
        const expected = scoped.filter((split) => split.kind === site.kind).length;
        expect(`${site.name} ${slug}: ${site.markup}`).toContain(
          `<span class="vscope v-${slug}">${String(expected)}</span>`,
        );
      }
    }
  });

  it("counts the corpus per version wherever it says how big it is", () => {
    // The counts describing the corpus rather than an answer: how many cases
    // there are, and how many of each tier. They sit above and beside the
    // chips, so a whole-corpus number here reads as a description of the rows
    // on screen.
    const sites = [
      { name: "header meta", markup: between('<div class="meta">', "</div>") },
      { name: "conformance intro", markup: between("<h2>Conformance</h2>", "</p>") },
      { name: "divergence intro", markup: between("<h2>Divergence</h2>", "</p>") },
    ];

    for (const version of versions) {
      const slug = `oas${version.replace(".", "")}`;
      const scoped = coverage(run.cases.filter((testCase) => testCase.oasVersion === version));
      const expected = {
        "header meta": [scoped.conformance + scoped.divergence, scoped.conformance, scoped.divergence],
        "conformance intro": [scoped.conformance],
        "divergence intro": [scoped.divergence],
      };
      for (const site of sites) {
        for (const value of expected[site.name as keyof typeof expected]) {
          expect(`${site.name} ${slug}: ${site.markup}`).toContain(
            `<span class="vscope v-${slug}">${String(value)}</span>`,
          );
        }
      }
    }
  });

  it("counts each coverage map against the surface of the version selected", () => {
    // The surface is per version: 3.2 defines a style the earlier versions do
    // not, so the same corpus covers a different denominator under each. One
    // number for the whole corpus would be a sum of three surfaces printed
    // under a filter showing one of them.
    for (const version of versions) {
      const slug = `oas${version.replace(".", "")}`;
      const scoped = coverage(run.cases.filter((testCase) => testCase.oasVersion === version));
      const styleMap = between("<h3>style surface</h3>", "</div>");
      expect(`style surface ${slug}: ${styleMap}`).toContain(
        `<dd class="vscope v-${slug}">${String(scoped.styleCovered)}</dd>`,
      );
      expect(`style surface ${slug}: ${styleMap}`).toContain(
        `<dd class="vscope v-${slug}">${String(scoped.styleDefined)}</dd>`,
      );
      const axisMap = between("<h3>probe axis</h3>", "</div>");
      for (const entry of scoped.byAxis) {
        expect(`probe axis ${entry.axis} ${slug}: ${axisMap}`).toContain(
          `<dd class="vscope v-${slug}${entry.cases === 0 ? " thin" : ""}">${String(entry.cases)}</dd>`,
        );
      }
    }
  });

  it("hides every variant the filter did not select", () => {
    for (const version of versions) {
      const slug = `oas${version.replace(".", "")}`;
      expect(html).toContain(`#oas-${slug}:checked ~ * .vscope:not(.v-${slug}){display:none}`);
    }
    expect(html).toContain("#oas-all:checked ~ * .vscope:not(.v-all){display:none}");
  });

  it("leads with cases of the version the filter selected", () => {
    for (const version of versions) {
      const slug = `oas${version.replace(".", "")}`;
      const start = html.indexOf(`readout-lead vscope v-${slug}`);
      expect(start).toBeGreaterThan(-1);
      const list = html.slice(start, html.indexOf("</ol>", start));
      const ids = [...list.matchAll(/<code>(.*?)<\/code>/g)].map((match) => match[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(id).toContain(`-${slug}`);
    }
  });
});

describe("the order measurements are handed in does not reach the page", () => {
  // Position is the one claim on this page no caption corrects: whoever is
  // leftmost reads as the one to look at first. So the page decides it, from
  // the package name, rather than inheriting whatever order a caller collected
  // its files in.
  it("renders the same page from a reversed list of entries", () => {
    expect(renderHtml(run.cases, [...entries].reverse())).toBe(html);
  });

  it("draws the roster in order of package name", () => {
    const drawn = [...html.matchAll(/<span class="lib-name">([^<]+)<\/span>/g)].map(
      (match) => match[1] ?? "",
    );
    expect(drawn).toEqual([...drawn].sort(compareLibraryNames));
    expect(drawn).toHaveLength(entries.length);
  });
});

describe("the roster explains its own strip", () => {
  // A strip of nine unexplained segments is why this exists: a reader who
  // cannot tell `split: cookie` from `contentDeserialization` cannot tell a
  // stage a library delegates from one it gets wrong, and the roster is drawn
  // to make exactly that difference visible.
  it("describes every segment a strip draws", () => {
    const legend = section("The roster").split('<div class="libs">')[0] ?? "";
    for (const slot of STAGE_SLOTS) {
      expect(legend).toContain(`<dt>${slot.title}</dt>`);
      expect(legend).toContain(`<dd>${slot.description}</dd>`);
    }
  });

  it("puts the legend before the libraries, where it is read first", () => {
    const roster = section("The roster");
    expect(roster.indexOf('<dl class="stages">')).toBeLessThan(
      roster.indexOf('<article class="lib">'),
    );
  });

  it("says what a filled segment and an empty one mean", () => {
    const legend = section("The roster").split('<div class="libs">')[0] ?? "";
    expect(legend).toContain("the library performs this stage");
    expect(legend).toContain("its caller supplies it");
  });

  it("gives every segment its description on hover too", () => {
    // The legend is read once; the strips are read repeatedly, and the label
    // under a segment is too short to carry the meaning on its own.
    for (const slot of STAGE_SLOTS) {
      expect(html).toContain(`title="${slot.title}. ${slot.description}"`);
    }
  });
});

describe("the divergence tier explains its results", () => {
  // Two results live in one cell, a verdict and a value observation, and four
  // of the states they can take are absences that mean different things. A
  // reader who cannot tell "publishes no values" from "produced none here"
  // reads a capability difference as a measurement.
  it.each([
    "accepted / rejected",
    "raised, no verdict",
    "not asked",
    "harness error",
    "not exposed by this library",
    "none reached",
  ])("names %s in the key", (term) => {
    expect(section("Divergence")).toContain(`<dt>${term}</dt>`);
  });

  it("marks every case the verdict cannot answer, and no others", () => {
    const marked = run.cases.filter(
      (testCase) => testCase.tier === "divergence" && testCase.answeredInValues === true,
    );
    // Counted in the table alone. The key mentions the mark too, and counting
    // that would make the test pass with the rows unmarked.
    const table = section("Divergence").split("</table>")[0] ?? "";
    expect(count(table, ">answered in values<")).toBe(marked.length);
    expect(marked.length).toBeGreaterThan(0);
  });

  it("says what the mark means where the marked rows are", () => {
    expect(section("Divergence")).toContain("A library exposing no values reaches a verdict");
  });
});

describe("a case id carries the case", () => {
  // A case id names a question and does not ask it, and the corpus that asks it
  // is a file somewhere else. What a reader can hover has to be the corpus text
  // itself: a note this page composed would be a second account of the case,
  // free to drift from the one the measurement was made against.
  it("gives every case row a note", () => {
    for (const heading of ["Conformance", "Divergence"]) {
      const tier = heading === "Conformance" ? "conformance" : "divergence";
      expect(count(section(heading), '<td class="lib-cell noted" title="')).toBe(
        casesIn(tier).length,
      );
    }
  });

  it("carries the corpus text, quoted spec included", () => {
    for (const testCase of run.cases) {
      const note = caseNote(testCase);
      // The note leads with the plain-language summary; the title's
      // coordinates are carried by the note's `shape` line instead.
      expect(note).toContain(testCase.inShort);
      expect(html).toContain(`title="${escapeForAttribute(note)}"`);
    }
  });

  it("escapes a note, so a quoted specification cannot end the attribute", () => {
    // Spec text is full of quotes, and the Style Examples rows are full of
    // markup-looking characters. An unescaped one would close the attribute and
    // silently drop the rest of the row.
    const quoted = run.cases.filter((testCase) => caseNote(testCase).includes('"'));
    expect(quoted.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/title="[^"]*[<>]/);
  });
});

/** The page's own escaping, repeated here rather than exported for a test. */
function escapeForAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

describe("what the page says is beside it", () => {
  // Rendering markdown is a separate command over the same directory, so a
  // directory can hold this page and no `matrix.md` at all. The page used to
  // name that file either way.
  it("names matrix.md as something to generate when it is not there", () => {
    const alone = renderHtml(run.cases, entries, run.sidecar, { markdown: false });
    expect(alone).toContain("pnpm render-md");
    expect(alone).not.toContain("beside this file");
  });

  it("points at matrix.md directly when it is there", () => {
    const beside = renderHtml(run.cases, entries, run.sidecar, { markdown: true });
    expect(beside).toContain("beside this file");
  });
});

describe("the page stands alone", () => {
  // A view that fetches anything is a view that renders differently depending
  // on where it is opened, and the same rule is why it is one file.
  it("fetches nothing when it renders", () => {
    expect(html.match(/<script|<link|<iframe|src=/g)).toBeNull();
  });

  it("reaches elsewhere only through a link the reader has to click", () => {
    // A source link on a roster card points off the page, which the rule above
    // permits: nothing is requested until a reader asks for it, and the page
    // renders the same with no network at all. Anchors are the only way out,
    // and they leave nothing behind them on the way.
    const outbound = [...html.matchAll(/<a\s[^>]*href="(?!#)([^"]*)"[^>]*>/g)];
    expect(outbound.length).toBeGreaterThan(0);
    for (const [tag, href] of outbound) {
      expect(href ?? "").toMatch(/^https:\/\//);
      expect(tag).toContain('rel="noreferrer noopener"');
    }
    // Every other href on the page stays inside it.
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href ?? "");
    for (const href of hrefs) {
      expect(href.startsWith("#") || href.startsWith("https://")).toBe(true);
    }
  });
});

function answerFor(measurement: LibraryMeasurement, caseId: string) {
  return measurement.answers.find((answer) => answer.caseId === caseId)?.result;
}

/** The page's own labels, which are what a reader sees in a cell. */
const LABELS = {
  pass: "pass",
  passVerdictOnly: "verdict only",
  failVerdict: "fail (verdict)",
  failValue: "fail (value)",
  libraryError: "raised",
  adapterError: "harness error",
  notApplicable: "not asked",
} as const;

describe("the page claims nothing the run does not carry", () => {
  const alone = renderHtml(run.cases, entries.slice(0, 1));

  // A measurement records the registry a library was installed from and says
  // nothing about what language it is written in, so a count of languages is a
  // number nobody can check against the JSON beside it. Counted claims only:
  // corpus prose reaches this page through the case notes and is not this
  // page's to police.
  it("counts no languages", () => {
    expect(html).not.toMatch(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+\w*\s?languages\b/i);
  });

  // A single-library run is the ordinary path rather than a comparison that
  // came back empty, and the two read alike if the page reports both as none.
  it("separates nothing to compare from compared and found nothing", () => {
    expect(alone).toContain("nothing for it to differ from");
    expect(alone).not.toContain("None in this run.");
    expect(html).not.toContain("nothing for it to differ from");
  });

  it("counts the libraries it was handed, in its own heading", () => {
    expect(alone).toContain("measured across 1 library<");
    expect(html).toContain(`measured across ${String(entries.length)} libraries<`);
  });
});

describe("the roster marks the registry each library came from", () => {
  /** The glyph on each card, in the order the cards are drawn. */
  function glyphs(page: string): readonly string[] {
    return [...page.matchAll(/class="lib-glyph"[^>]*>([^<]*)</g)].map(([, glyph]) => glyph ?? "");
  }

  it("marks every card", () => {
    expect(glyphs(html)).toHaveLength(entries.length);
  });

  // The map is keyed on the ecosystem string a measurement carries, and a new
  // one arriving is exactly when a hand-written map goes quietly stale. A card
  // falling back to the neutral mark is the visible form of that, so it fails
  // here instead.
  it("knows every registry this run holds", () => {
    const neutral = glyphs(html).filter((glyph) => glyph === "&#9675;");
    expect(neutral).toEqual([]);
  });

  it("marks a registry it does not know rather than drawing nothing", () => {
    const stranger: Entry[] = [
      {
        label: entries[0]?.label ?? "",
        measurement: {
          ...(entries[0] as Entry).measurement,
          provenance: {
            ...(entries[0] as Entry).measurement.provenance,
            ecosystem: "unknown",
          },
        },
      },
    ];
    expect(glyphs(renderHtml(run.cases, stranger))).toEqual(["&#9675;"]);
  });

  // Generated output is ASCII, so a glyph travels as a character reference and
  // the file stays readable in any editor that opens it.
  it("writes a page with nothing above ASCII in it", () => {
    const above = [...html].filter((character) => (character.codePointAt(0) ?? 0) > 127);
    expect(above).toEqual([]);
  });
});
