import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import { readRun } from "../../src/report/read";
import { renderCorpus, renderMarkdown } from "../../src/report/render";
import { coverage, presentVersions, versionSlug } from "../../src/report/view";
import { CONTENT_MEDIA_TYPES } from "../../src/surface/surface";

/**
 * Every rendered byte of the committed report, without a container.
 *
 * Rendering is a pure function of a run directory, so the check is to read the
 * questions and the answers off disk, render them, and compare. Asserting it
 * here costs milliseconds; asserting it through a fresh run would cost a build
 * and boot of the whole roster.
 *
 * What this cannot see is whether the measurements on disk still match what the
 * libraries do, which is the container tier's job in
 * `test/adapters/freshRun.test.ts`. Stale JSON renders perfectly green here.
 */

const reportDir = fileURLToPath(new URL("../../report", import.meta.url));
const run = readRun(reportDir);

describe("the committed corpus matches this checkout", () => {
  it("holds exactly the questions src/corpus asks", () => {
    // The other direction of the same seam: rendering trusts the corpus in the
    // directory, so nothing above would notice the committed one drifting from
    // the corpus that produced it.
    expect(readFileSync(join(reportDir, "corpus.json"), "utf8")).toBe(renderCorpus(cases));
  });
});

describe("the committed markdown matches a fresh render of the committed measurements", () => {
  const artifacts = renderMarkdown(run.cases, run.measurements);

  it("gives a run directory a way in that defines the words the rest of it uses", () => {
    // Every other artifact opens in the middle of its own argument, which is
    // right for that file and leaves a reader who has just arrived with no idea
    // what a case is or why a cell can read `n/a` with nobody at fault. The page
    // carries that orientation and the page is not committed.
    const readme = artifacts["README.md"] ?? "";
    for (const term of ["case", "library", "adapter", "measurement", "stage"]) {
      expect(readme).toContain(`| ${term} |`);
    }
    // The two tiers, in the words that distinguish them, because that
    // distinction is what the whole directory is arranged around.
    expect(readme).toContain("**Conformance**");
    expect(readme).toContain("**Divergence**");
    expect(readme).toContain("never scored");
    // And where to go next, including the measurement the markdown reads from.
    for (const file of ["matrix.oas31.md", "coverage.oas31.md", "corpus.json"]) {
      expect(readme).toContain(file);
    }
  });

  it("writes no markdown the report lacks, and none it has extra", () => {
    // Names compared as a set of their own. A renamed artifact would otherwise
    // pass silently, since the loop below only visits what was generated and
    // the stale file would sit in the report unchecked.
    expect(Object.keys(artifacts).sort()).toEqual(committedMarkdown().sort());
  });

  for (const name of Object.keys(artifacts)) {
    it(name, () => {
      expect(artifacts[name]).toBe(readFileSync(join(reportDir, name), "utf8"));
    });
  }
});

describe("the markdown says what a result means", () => {
  const matrix = renderMarkdown(run.cases, run.measurements)["matrix.oas31.md"] ?? "";

  // The three absences a value column can hold read alike and mean different
  // things: never asked, publishes no values, produced none here. A reader
  // without the key takes a capability difference for a measurement.
  it.each([
    "`accepted`, `rejected`",
    "`raised, no verdict`",
    "`not asked (<reason>)`",
    "`harness error`",
    "`not exposed by this library`",
    "`none reached`",
  ])("keys %s", (term) => {
    expect(matrix).toContain(`| ${term} |`);
  });

  it("marks every case the verdict cannot answer", () => {
    // Scoped to the matrix's own version: each matrix file holds one version's
    // cases, and comparing it against the whole corpus counted every version's
    // marks against one file's.
    const marked = run.cases.filter(
      (testCase) =>
        testCase.tier === "divergence" &&
        testCase.answeredInValues === true &&
        testCase.oasVersion === "3.1",
    );
    expect(marked.length).toBeGreaterThan(0);
    expect(matrix.split("**Answered in the values.**").length - 1).toBe(marked.length);
    for (const testCase of marked) expect(matrix).toContain(`#### \`${testCase.id}\``);
  });
});

describe("the coverage table and the coverage numbers are one claim", () => {
  // The markdown drew the content surface with its `condition` axis while the
  // view counted it without, so the page said twenty-four cells and the JSON
  // said twelve. Whoever reads the number and whoever reads the table have to
  // be looking at the same surface.
  const artifacts = renderMarkdown(run.cases, run.measurements);

  for (const version of presentVersions(run.cases)) {
    it(`coverage.${versionSlug(version)}.md counts what the view counts`, () => {
      const page = artifacts[`coverage.${versionSlug(version)}.md`] ?? "";
      const view = coverage(run.cases.filter((testCase) => testCase.oasVersion === version));
      const stated = [...page.matchAll(/Defined combinations: (\d+)\. Covered: (\d+)\./g)].map(
        (match) => [Number(match[1]), Number(match[2])],
      );

      // Two such lines: the style surface, then the content surface.
      expect(stated).toEqual([
        [view.styleDefined, view.styleCovered],
        [view.contentDefined, view.contentCovered],
      ]);
      // And the table under the content line draws exactly the cells it counts.
      // Summed over the media type axis rather than counting one member of it,
      // so widening that axis cannot leave this checking a fraction of the
      // table and still passing.
      const drawn = CONTENT_MEDIA_TYPES.reduce(
        (total, mediaType) => total + page.split(`| ${mediaType} |`).length - 1,
        0,
      );
      expect(drawn).toBe(view.contentDefined);
    });
  }
});

describe("the order libraries are handed in does not reach the markdown", () => {
  // The committed report is ordered because `readRun` sorts, so nothing above
  // would notice the renderer drawing its columns in whatever order it was
  // given. Reversed input renders the same bytes or the order is the caller's.
  it("renders the same bytes from a reversed list of measurements", () => {
    expect(renderMarkdown(run.cases, [...run.measurements].reverse())).toEqual(
      renderMarkdown(run.cases, run.measurements),
    );
  });
});

/**
 * Every markdown file in the report.
 *
 * JSON is excluded because `measure` writes it and this compares what
 * `render-md` writes. `index.html` is excluded because nothing compares a view:
 * it is regenerated on demand and git ignores it.
 */
function committedMarkdown(): string[] {
  const found: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".md")) found.push(`${prefix}${entry.name}`);
    }
  };
  walk(reportDir, "");
  return found;
}
