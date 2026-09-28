import { describe, expect, it } from "vitest";
import type { Case, ConformanceCase, DivergenceCase, ProbeAxis } from "../../src/types/case";
import type { LibraryMeasurement } from "../../src/types/measurement";
import type { AdapterResult, DeserializedValues, UnsupportedReason } from "../../src/types/result";
import { renderHtml } from "../../src/report/html";
import { renderMarkdown } from "../../src/report/render";
import { score } from "../../src/report/score";
import { valuesText } from "../../src/report/cells";
import {
  caseNote,
  caseNotes,
  conformanceTallies,
  contentConditionOf,
  corpusAgreement,
  disagreements,
  divergenceGrid,
  orderEntries,
  orderMeasurements,
  orderSources,
  placeContentCases,
  resolveLabels,
  sharpestSplits,
  roster,
  versionDeltas,
  type Disagreement,
  type Entry,
} from "../../src/report/view";

/**
 * The report's derivations, over measurements built here rather than read from
 * `report/`.
 *
 * Synthetic on purpose. Asserting these against the committed report would make
 * the test agree with whatever the current roster happens to do, so a rule that
 * misses a case would pass for as long as no library exercised it. These
 * fixtures contain the cases that are easy to get wrong: a measurement that was
 * never asked, one that raised, and two that accept while returning different
 * values.
 */

const CITATION = {
  oasVersion: "3.1",
  anchor: "parameter-object",
  url: "https://spec.openapis.org/oas/v3.1.0#parameter-object",
  quoted: "irrelevant to the derivation under test",
} as const;

function conformanceCase(id: string): ConformanceCase {
  return {
    id,
    title: id,
    inShort: "a plain sentence, distinct from the quoted text",
    tier: "conformance",
    oasVersion: "3.1",
    citations: [CITATION],
    expected: "accepted",
    expectedValues: { p: "blue" },
    rationale: "fixture",
    document: {
      openapi: "3.1.0",
      info: { title: "fixture", version: "1" },
      paths: {
        "/t": {
          get: {
            parameters: [
              { name: "p", in: "query", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    },
    request: { method: "GET", target: "/t", headers: [] },
    dimensions: {
      declaration: "schema",
      location: "query",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "scalar",
      probeAxis: "canonical",
    },
    varies: [],
    holdsConstant: [],
  };
}

function divergenceCase(id: string): DivergenceCase {
  return {
    id,
    title: id,
    inShort: "a plain sentence, distinct from the quoted text",
    tier: "divergence",
    oasVersion: "3.1",
    question: "which separator joins the repeats is not written down",
    basis: CITATION,
    document: {
      openapi: "3.1.0",
      info: { title: "fixture", version: "1" },
      paths: { "/t": { get: { responses: { "200": { description: "ok" } } } } },
    },
    request: { method: "GET", target: "/t", headers: [] },
    dimensions: {
      declaration: "schema",
      location: "cookie",
      style: "form",
      explode: true,
      declaredStyle: "form",
      declaredExplode: true,
      schema: "array",
      probeAxis: "foreignWireShape",
    },
    varies: ["the location separates repeats differently"],
    holdsConstant: ["the style and explode are declared"],
  };
}

const cases: readonly Case[] = [conformanceCase("a"), conformanceCase("b")];

/** An answer that reports some values and names a parameter it could not read. */
function acceptedWithUnreadable(
  values: DeserializedValues,
  unreadable: Record<string, string>,
): AdapterResult {
  return {
    library: "lib",
    libraryVersion: "1.0.0",
    configurationId: "fixture",
    preparse: null,
    outcome: "accepted",
    deserialized: {
      kind: "observed",
      vantage: "handedToHandler",
      value: values,
      nativeTypes: {},
      unreadable,
    },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function accepted(values: DeserializedValues | null): AdapterResult {
  return {
    library: "lib",
    libraryVersion: "1.0.0",
    configurationId: "fixture",
    preparse: null,
    outcome: "accepted",
    deserialized:
      values === null
        ? { kind: "unexposed", reason: "no published call returns values" }
        : { kind: "observed", vantage: "handedToHandler", value: values, nativeTypes: {} },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function rejected(): AdapterResult {
  return {
    library: "lib",
    libraryVersion: "1.0.0",
    configurationId: "fixture",
    preparse: null,
    outcome: "rejected",
    deserialized: { kind: "notReached", reason: "rejected before values" },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  };
}

function raised(): AdapterResult {
  return {
    library: "lib",
    libraryVersion: "1.0.0",
    configurationId: "fixture",
    preparse: null,
    outcome: "libraryError",
    detail: "threw",
    raw: null,
  };
}

function measurement(
  library: string,
  version: string,
  answers: Record<string, AdapterResult>,
  overrides: { corpusDigest?: string } = {},
): LibraryMeasurement {
  return {
    schemaVersion: 1,
    library,
    libraryVersion: version,
    librarySource: null,
    libraryResolution: { kind: "registry", specifier: "latest" },
    corpusDigest: overrides.corpusDigest ?? "sha256:same",
    capabilities: {
      stages: {
        routing: true,
        splitting: { cookie: false, header: true, path: true, query: true },
        styleDeserialization: true,
        contentDeserialization: false,
        schemaValidation: true,
        valueExposure: true,
      },
      queryPairInput: "notUsed",
      oasVersions: { "3.0": false, "3.1": true, "3.2": false },
    },
    capabilityEvidence: [],
    versionEvidence: [],
    configuration: { id: "fixture", description: "fixture", options: {} },
    provenance: { kind: "container", slug: library, imageId: "sha256:image", ecosystem: "npm" },
    answers: Object.entries(answers).map(([caseId, result]) => ({ caseId, result })),
  };
}

describe("what a reader who has just arrived is shown first", () => {
  function split(caseId: string, accepted: number, rejected: number): Disagreement {
    return {
      caseId,
      title: caseId,
      tier: "divergence",
      kind: "verdict",
      answers: [
        ...Array.from({ length: accepted }, (_, i) => ({
          label: `a${String(i)}`,
          verdict: "accepted",
          values: "",
        })),
        ...Array.from({ length: rejected }, (_, i) => ({
          label: `r${String(i)}`,
          verdict: "rejected",
          values: "",
        })),
      ],
    };
  }

  it("puts the evenest split first, then the one more of the field answered", () => {
    const found = [
      split("lopsided-oas31", 8, 1),
      split("even-small-oas31", 2, 2),
      split("even-large-oas31", 5, 5),
    ];
    expect(sharpestSplits(found, 3).map((one) => one.disagreement.caseId)).toEqual([
      "even-large-oas31",
      "even-small-oas31",
      "lopsided-oas31",
    ]);
  });

  it("counts the two verdicts it reports", () => {
    const [first] = sharpestSplits([split("c-oas31", 6, 3)], 1);
    expect(first?.accepted).toBe(6);
    expect(first?.rejected).toBe(3);
  });

  it("shows one version of a case rather than both", () => {
    // The mirror in the other specification version is the same question asked
    // twice, and a list of two that shows one of them twice is a list of one.
    const found = [split("c-oas30", 5, 5), split("c-oas31", 5, 5), split("d-oas31", 4, 4)];
    expect(sharpestSplits(found, 2).map((one) => one.disagreement.caseId)).toEqual([
      "c-oas30",
      "d-oas31",
    ]);
  });

  it("leaves a value split out of an order about verdicts", () => {
    const value: Disagreement = { ...split("v-oas31", 0, 0), kind: "value" };
    expect(sharpestSplits([value], 4)).toEqual([]);
  });
});

describe("a content case that sends no representation fills no cell", () => {
  // The condition axis has two halves, and both mean something arrived. An
  // axis that sends nothing at all belongs in neither: counting it as
  // wellFormed would mark a cell covered by a case whose whole point is that
  // no representation was sent.
  function contentCase(id: string, probeAxis: ProbeAxis): Case {
    const base = conformanceCase(id);
    return {
      ...base,
      dimensions: {
        declaration: "content",
        location: "query",
        mediaType: "application/json",
        schema: "object",
        probeAxis,
      },
    };
  }

  it.each(["missingName", "nameWithoutValue", "optionalAbsent"] as const)(
    "places no cell for %s",
    (probeAxis) => {
      expect(contentConditionOf(contentCase("c", probeAxis))).toBeNull();
      expect(placeContentCases([contentCase("c", probeAxis)], "3.1").covered.size).toBe(0);
    },
  );

  it("still places a case that sends one", () => {
    expect(placeContentCases([contentCase("c", "canonical")], "3.1").covered.size).toBe(1);
    expect(placeContentCases([contentCase("c", "foreignWireShape")], "3.1").covered.size).toBe(1);
  });
});

describe("the roster", () => {
  it("counts owned stages without naming any library", () => {
    const rows = roster([
      { label: "one", measurement: measurement("lib", "1.0.0", {}) },
    ]);
    const row = rows[0];
    if (row === undefined) throw new Error("no row");
    // Six stages with splitting counted per location: nine slots, of which
    // cookie splitting and content deserialization are delegated here.
    expect({ owned: row.ownedCount, total: row.stageCount }).toEqual({ owned: 7, total: 9 });
    expect(row.ecosystem).toBe("npm");
  });
});

describe("conformance tallies", () => {
  it("counts a case the measurement holds no answer for as unanswered, apart from unasked", () => {
    // The row has to sum to the corpus size whatever the measurement contains,
    // or a reader comparing two rows is comparing different denominators.
    const tallies = conformanceTallies(cases, [
      { label: "partial", measurement: measurement("lib", "1.0.0", { a: accepted({ p: "blue" }) }) },
    ]);
    const tally = tallies[0];
    if (tally === undefined) throw new Error("no tally");
    const summed = Object.values(tally.counts).reduce((total, count) => total + count, 0);
    expect({
      summed,
      total: tally.total,
      unanswered: tally.counts.unanswered,
      unasked: tally.counts.notApplicable,
    }).toEqual({
      summed: 2,
      total: 2,
      unanswered: 1,
      unasked: 0,
    });
  });

  it("keeps a raise out of the verdict columns", () => {
    const tallies = conformanceTallies(cases, [
      { label: "thrower", measurement: measurement("lib", "1.0.0", { a: raised(), b: raised() }) },
    ]);
    expect(tallies[0]?.counts).toMatchObject({ libraryError: 2, failVerdict: 0, pass: 0 });
  });
});

describe("disagreement", () => {
  const two = (one: AdapterResult, other: AdapterResult): Entry[] => [
    { label: "one", measurement: measurement("first", "1.0.0", { a: one }) },
    { label: "other", measurement: measurement("second", "1.0.0", { a: other }) },
  ];

  it("finds a split in the values where the verdicts agree", () => {
    // The finding a verdict column cannot show. Both accepted, and their
    // callers receive different things.
    const found = disagreements(cases, two(accepted({ p: "blue" }), accepted({ p: "BLUE" })));
    expect(found.map((entry) => ({ id: entry.caseId, kind: entry.kind }))).toEqual([
      { id: "a", kind: "value" },
    ]);
  });

  it("calls a split verdict a verdict split even when values also differ", () => {
    const found = disagreements(cases, two(accepted({ p: "blue" }), rejected()));
    expect(found[0]?.kind).toBe("verdict");
  });

  it("says nothing when one side was never asked", () => {
    // A measurement that was not asked is not a dissenting opinion, and
    // counting it as one turns a capability difference into a finding about
    // the specification.
    const found = disagreements(cases, [
      { label: "one", measurement: measurement("first", "1.0.0", { a: accepted({ p: "blue" }) }) },
      { label: "other", measurement: measurement("second", "1.0.0", {}) },
    ]);
    expect(found).toEqual([]);
  });

  function observedFrom(
    verdict: "accepted" | "rejected",
    vantage: "handedToHandler" | "parsedBeforeValidation" | "validatedOnly",
    value: DeserializedValues,
    unreadable?: Record<string, string>,
  ): AdapterResult {
    return {
      library: "lib",
      libraryVersion: "1.0.0",
      configurationId: "fixture",
      preparse: null,
      outcome: verdict,
      deserialized: {
        kind: "observed",
        vantage,
        value,
        nativeTypes: {},
        ...(unreadable === undefined ? {} : { unreadable }),
      },
      inputMutation: { kind: "none", detail: "fixture" },
      raw: null,
    };
  }

  it("does not read a different key order as a different value", () => {
    const found = disagreements(
      cases,
      two(accepted({ p: { r: 100, g: 200 } }), accepted({ p: { g: 200, r: 100 } })),
    );
    expect(found).toEqual([]);
  });

  it("does not read a parameter one container could not read as a split", () => {
    const found = disagreements(
      cases,
      two(
        accepted({ p: "blue", q: "x" }),
        acceptedWithUnreadable({ p: "blue" }, { q: "no slot in this request shape" }),
      ),
    );
    expect(found).toEqual([]);
  });

  it("does not read an absence the vantage accounts for as a split", () => {
    // No handler runs on a rejected request, so a handler vantage reports
    // nothing there, and a validated-only vantage omits a name that failed.
    const parsed = observedFrom("rejected", "parsedBeforeValidation", { p: "x" });
    expect(disagreements(cases, two(parsed, observedFrom("rejected", "handedToHandler", {})))).toEqual(
      [],
    );
    expect(disagreements(cases, two(parsed, observedFrom("rejected", "validatedOnly", {})))).toEqual(
      [],
    );
  });

  it("reads an absence the vantage does not account for as a split", () => {
    const found = disagreements(
      cases,
      two(
        observedFrom("rejected", "parsedBeforeValidation", { p: "x" }),
        observedFrom("rejected", "parsedBeforeValidation", {}),
      ),
    );
    expect(found.map((entry) => entry.kind)).toEqual(["value"]);
  });

  it("reads a name omitted on an accepted request as a split, whatever the vantage", () => {
    // Nothing failed and a handler ran, so the omission is what the caller got.
    const found = disagreements(
      cases,
      two(
        observedFrom("accepted", "parsedBeforeValidation", { p: "" }),
        observedFrom("accepted", "validatedOnly", {}),
      ),
    );
    expect(found.map((entry) => entry.kind)).toEqual(["value"]);
  });

  it("names the vantage beside each answer's values", () => {
    const found = disagreements(cases, two(accepted({ p: "blue" }), accepted({ p: "BLUE" })));
    expect(found[0]?.answers.map((answer) => answer.values)).toEqual([
      '{"p":"blue"} (handed to the handler)',
      '{"p":"BLUE"} (handed to the handler)',
    ]);
  });

  it("does not read an unexposed value channel as a different value", () => {
    // "Exposes nothing, ever" and "exposed something else" are different facts,
    // and only the second is a disagreement.
    const found = disagreements(cases, two(accepted({ p: "blue" }), accepted(null)));
    expect(found).toEqual([]);
  });
});

describe("version deltas", () => {
  it("reports only what moved, between measurements of one library", () => {
    const deltas = versionDeltas(cases, [
      {
        label: "5.0.0",
        measurement: measurement("same", "5.0.0", { a: accepted({ p: "blue" }), b: rejected() }),
      },
      {
        label: "5.1.0",
        measurement: measurement("same", "5.1.0", {
          a: accepted({ p: "blue" }),
          b: accepted({ p: "blue" }),
        }),
      },
    ]);
    expect(deltas).toEqual([
      {
        library: "same",
        from: "5.0.0",
        to: "5.1.0",
        moved: [
          {
            caseId: "b",
            before: { outcome: "failVerdict", reason: null },
            after: { outcome: "pass", reason: null },
          },
        ],
      },
    ]);
  });

  it("reports a case that moved between two reasons for not being asked", () => {
    const withheld = (reason: "stageNotOwned" | "cannotRepresentCase"): AdapterResult => ({
      library: "lib",
      libraryVersion: "1.0.0",
      configurationId: "fixture",
      preparse: null,
      outcome: "unsupported",
      reason,
      detail: "fixture",
    });
    const deltas = versionDeltas(cases, [
      { label: "1", measurement: measurement("same", "1.0.0", { a: withheld("stageNotOwned") }) },
      { label: "2", measurement: measurement("same", "2.0.0", { a: withheld("cannotRepresentCase") }) },
    ]);
    expect(deltas[0]?.moved.filter((move) => move.caseId === "a")).toEqual([
      {
        caseId: "a",
        before: { outcome: "notApplicable", reason: "stageNotOwned" },
        after: { outcome: "notApplicable", reason: "cannotRepresentCase" },
      },
    ]);
  });

  it("says nothing about two different libraries", () => {
    // Across libraries a differing cell is a disagreement rather than a change,
    // and labelling it a change would invent a history that does not exist.
    const deltas = versionDeltas(cases, [
      { label: "one", measurement: measurement("first", "1.0.0", { a: rejected() }) },
      { label: "other", measurement: measurement("second", "1.0.0", { a: accepted(null) }) },
    ]);
    expect(deltas).toEqual([]);
  });
});

describe("the note a case carries", () => {
  it("says what the specification requires and names the text that requires it", () => {
    const note = caseNote({
      ...conformanceCase("a"),
      inShort: "sends a comma-joined list and expects it taken as two items",
      rationale: "the form row joins an array with commas",
      varies: ["the name is one the document does not declare"],
      holdsConstant: ["the value is well-formed for its declared type"],
    });
    expect(note).toContain("sends a comma-joined list and expects it taken as two items");
    expect(note).toContain("sends:");
    expect(note).toContain("GET /t");
    expect(note).toMatch(/expects:\s+accepted/);
    expect(note).toMatch(/values:\s+\{"p":"blue"\}/);
    expect(note).toContain("why: the form row joins an array with commas");
    expect(note).toContain("varies: the name is one the document does not declare");
    expect(note).toContain("holds constant: the value is well-formed for its declared type");
    expect(note).toContain(`required by, in OAS 3.1: ${CITATION.anchor}`);
  });

  it("says what the document declares, not only what the request sends", () => {
    // Without this the note showed a request and left the reader to work out
    // from the title which part of it the document meant. A header case is the
    // worst of them: it looks like a request that happens to carry a header.
    const note = caseNote(conformanceCase("a"));
    expect(note).toContain("declares:");
    expect(note).toContain("p in query");
  });

  it("lines the facts up in one column, since a hover has no other formatting", () => {
    const note = caseNote(conformanceCase("a"));
    const facts = note
      .split("\n")
      .filter((line) => /^(sends|declares|expects|values):/.test(line));
    expect(facts.length).toBeGreaterThan(1);
    // Every value starts at the same column, which is what makes the labels
    // scannable in unstyled text.
    const columns = new Set(facts.map((line) => line.indexOf(line.trim().split(/:\s+/)[1] ?? "")));
    expect(columns.size).toBe(1);
  });

  it("leads with the plain sentence and the request, before the argument", () => {
    // The order is the point of the note. A reader hovering a row is asking
    // what this case does, and the case for the verdict is the answer to a
    // question they have next, so it sits below.
    const note = caseNote({
      ...conformanceCase("a"),
      inShort: "the short one",
      rationale: "the long one",
    });
    expect(note.indexOf("the short one")).toBeLessThan(note.indexOf("sends:"));
    expect(note.indexOf("sends:")).toBeLessThan(note.indexOf("why: the long one"));
  });

  it("names the rules rather than quoting them, because the quotes are long", () => {
    // A third of everything the hover showed was quoted specification text,
    // spent on the part of a case a reader scanning never reads. `matrix.md`
    // carries the quotes beside the same case.
    const note = caseNote(conformanceCase("a"));
    expect(note).not.toContain(CITATION.quoted);
    expect(note).toContain("matrix.oas31.md");
  });

  it("asks a divergence case rather than answering it", () => {
    // No expectation reaches a divergence note, because there is none to
    // report and a reader shown one would take it for an oracle.
    const note = caseNote(divergenceCase("d"));
    expect(note).toContain("open question: which separator joins the repeats");
    expect(note).toContain("left open in OAS 3.1 by:");
    expect(note).not.toContain("expects:");
    expect(note).not.toContain("required by, in OAS");
  });

  it("says a divergence case the specification is silent on has nothing to quote", () => {
    const note = caseNote({ ...divergenceCase("d"), basis: null });
    expect(note).toContain("left open in OAS 3.1 by silence, so there is no rule to name.");
  });

  it("names the canonical case as varying nothing rather than leaving a blank", () => {
    // An empty line reads as a case whose dimensions nobody wrote down. The
    // canonical case varies nothing on purpose, and that is the fact the probe
    // design rule turns on.
    expect(caseNote(conformanceCase("a"))).toContain("varies: nothing, this is the canonical case");
  });

  it("marks a style the document left out as defaulted", () => {
    // Resolving a default is work a library handed the style never did, so the
    // two are different cells in the coverage map and read differently here.
    const note = caseNote({
      ...conformanceCase("a"),
      dimensions: {
        declaration: "schema",
        location: "query",
        style: "form",
        explode: true,
        declaredStyle: "unset",
        declaredExplode: "unset",
        schema: "scalar",
        probeAxis: "canonical",
      },
    });
    expect(note).toContain("style form (defaulted), explode true (defaulted)");
  });

  it("says when a case is answered in the values rather than the verdict", () => {
    // The distinction a reader cannot make from the table: two libraries both
    // accept, and the whole finding is in what each handed back.
    const note = caseNote({ ...divergenceCase("d"), answeredInValues: true });
    expect(note).toContain("answered in the values");
    expect(note).toContain("exposes no deserialized values reaches a verdict here");
  });

  it("says nothing of the kind for a case the verdict can carry", () => {
    expect(caseNote(divergenceCase("d"))).not.toContain("answered in the values");
  });

  it("keys every case in the corpus", () => {
    const notes = caseNotes(cases);
    expect([...notes.keys()]).toEqual(cases.map((testCase) => testCase.id));
  });
});

describe("the divergence grid", () => {
  it("carries whether the verdict can answer a case at all", () => {
    // The renderers mark these rows, and a mark computed in a renderer is a
    // judgement made twice. It is read off the case here, once.
    const grid = divergenceGrid(
      [divergenceCase("plain"), { ...divergenceCase("valued"), answeredInValues: true }],
      [{ label: "one", measurement: measurement("lib", "1.0.0", {}) }],
    );
    expect(grid.map((row) => ({ id: row.caseId, values: row.answeredInValues }))).toEqual([
      { id: "plain", values: false },
      { id: "valued", values: true },
    ]);
  });
});

describe("ordering", () => {
  const at = (library: string, version: string, runStartedAt: string | null = null) => ({
    measurement: measurement(library, version, {}),
    explicitLabel: null,
    runStartedAt,
    source: `/runs/${library}-${version}`,
  });

  it("puts entries in order of package name, not of file name", () => {
    // `example.alpha` slugs to `example-alpha`, which sorts before
    // `example-beta`; the names sort the other way, because a dash precedes a
    // dot. The package name is the ordering key everywhere in this repository.
    const ordered = orderSources([at("example.alpha", "1.0.0"), at("example-beta", "1.0.0")]);
    expect(ordered.map((entry) => entry.measurement.library)).toEqual([
      "example-beta",
      "example.alpha",
    ]);
  });

  it("reads a name from its first letter, so a leading @ is not a head start", () => {
    // `@` precedes every letter in ASCII, so a scoped package sorted above the
    // whole roster whatever it was called, and first on a page reads as a claim
    // nobody made.
    const ordered = orderSources([
      at("zeta", "1.0.0"),
      at("@scope/middle", "1.0.0"),
      at("alpha", "1.0.0"),
    ]);
    expect(ordered.map((entry) => entry.measurement.library)).toEqual([
      "alpha",
      "@scope/middle",
      "zeta",
    ]);
  });

  it("keeps a stripped name and the name it stripped from apart", () => {
    // Otherwise the two compare equal and their order is whichever was read
    // first, which is the file system deciding a column position.
    const ordered = orderSources([at("scope/name", "1.0.0"), at("@scope/name", "1.0.0")]);
    expect(ordered.map((entry) => entry.measurement.library)).toEqual([
      "@scope/name",
      "scope/name",
    ]);
  });

  it("interleaves two runs rather than keeping each run together", () => {
    // Passing two runs of two libraries must not produce two alphabetical
    // halves in the order the inputs were typed. One order, always.
    const ordered = orderSources([
      at("b", "1.0.0"),
      at("a", "1.0.0"),
      at("b", "2.0.0"),
      at("a", "2.0.0"),
    ]);
    expect(ordered.map((entry) => `${entry.measurement.library}@${entry.measurement.libraryVersion}`)).toEqual([
      "a@1.0.0",
      "a@2.0.0",
      "b@1.0.0",
      "b@2.0.0",
    ]);
  });

  it("reads digit runs as numbers, so 5.10.0 follows 5.6.2", () => {
    // ASCII order would present an upgrade as a downgrade and label the delta
    // backwards.
    const ordered = orderSources([at("same", "5.10.0"), at("same", "5.6.2")]);
    expect(ordered.map((entry) => entry.measurement.libraryVersion)).toEqual(["5.6.2", "5.10.0"]);
  });

  it("orders two runs of one version by when they ran", () => {
    const ordered = orderSources([
      at("same", "1.0.0", "2026-02-01T00:00:00.000Z"),
      at("same", "1.0.0", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(ordered.map((entry) => entry.runStartedAt)).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ]);
  });

  it("orders bare measurements by the same keys", () => {
    // What the markdown renderer sorts by, which reaches it without the run
    // time, image and file a source carries. Name, then version.
    const ordered = orderMeasurements([
      measurement("b", "1.0.0", {}),
      measurement("a", "5.10.0", {}),
      measurement("a", "5.6.2", {}),
    ]);
    expect(ordered.map((one) => `${one.library}@${one.libraryVersion}`)).toEqual([
      "a@5.6.2",
      "a@5.10.0",
      "b@1.0.0",
    ]);
  });

  it("leaves entries a source order already separated where they are", () => {
    // The entry sort settles the name and the version and stops there, so a
    // tie `orderSources` already broke on run time, image or file survives it
    // rather than being resorted on a display label.
    const sources = orderSources([
      at("same", "1.0.0", "2026-01-01T00:00:00.000Z"),
      at("same", "1.0.0", "2026-02-01T00:00:00.000Z"),
    ]);
    const entries = resolveLabels(sources);
    expect(orderEntries(entries)).toEqual(entries);
  });
});

describe("labelling", () => {
  const source = (
    library: string,
    version: string,
    extra: { runStartedAt?: string; imageId?: string; source?: string } = {},
  ) => ({
    measurement: {
      ...measurement(library, version, {}),
      provenance: {
        kind: "container" as const,
        slug: library,
        imageId: extra.imageId ?? "sha256:image0000000",
        ecosystem: "npm" as const,
      },
    },
    explicitLabel: null,
    runStartedAt: extra.runStartedAt ?? null,
    source: extra.source ?? `/runs/${library}-${version}.json`,
  });

  it("leaves a unique library name alone", () => {
    const labels = resolveLabels([source("one", "1.0.0"), source("other", "1.0.0")]);
    expect(labels.map((entry) => entry.label)).toEqual(["one", "other"]);
  });

  it("separates two versions of one library by version", () => {
    const labels = resolveLabels([source("same", "1.0.0"), source("same", "2.0.0")]);
    expect(labels.map((entry) => entry.label)).toEqual(["same 1.0.0", "same 2.0.0"]);
  });

  it("separates two runs of one version by when they ran", () => {
    // The case the run sidecar exists for. Same library, same version, same
    // image: the only thing that differs is when it happened, and two columns
    // with the same name would render a comparison a reader cannot read.
    const labels = resolveLabels([
      source("same", "1.0.0", { runStartedAt: "2026-01-01T00:00:00.000Z" }),
      source("same", "1.0.0", { runStartedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    // Only the qualifier that separates them is appended. The version is equal
    // in both, so repeating it would add length and no information, and the
    // roster card carries it anyway.
    expect(labels.map((entry) => entry.label)).toEqual([
      "same 2026-01-01T00:00:00.000Z",
      "same 2026-02-01T00:00:00.000Z",
    ]);
  });

  it("falls through to the image when there is no run record", () => {
    const labels = resolveLabels([
      source("same", "1.0.0", { imageId: "sha256:aaaaaaaaaaaa" }),
      source("same", "1.0.0", { imageId: "sha256:bbbbbbbbbbbb" }),
    ]);
    expect(labels.map((entry) => entry.label)).toEqual([
      "same aaaaaaaaaaaa",
      "same bbbbbbbbbbbb",
    ]);
  });

  it("indexes inputs that nothing distinguishes", () => {
    // Two copies of one measurement. Numbering them says the page could not
    // tell them apart, which is the honest thing for it to say.
    const same = source("same", "1.0.0", { source: "/same.json" });
    const labels = resolveLabels([same, same]);
    expect(labels.map((entry) => entry.label)).toEqual(["same #1", "same #2"]);
  });
});

describe("corpus agreement", () => {
  it("notices when two measurements answered different corpora", () => {
    const check = corpusAgreement([
      { label: "one", measurement: measurement("first", "1.0.0", {}) },
      {
        label: "other",
        measurement: measurement("second", "1.0.0", {}, { corpusDigest: "sha256:different" }),
      },
    ]);
    expect(check.agreed).toBe(false);
    expect(check.digests).toHaveLength(2);
  });
});

describe("a parameter the container could not read", () => {
  const unreadable = { q: "this library's request shape has no slot for it" };

  it("scores as a pass with the value unread rather than a value failure", () => {
    // The whole-case `unexposed` answer narrowed to one name, and it passes on
    // the verdict the same way, under an outcome that says which of the two it
    // was. Reading the container's reach as the library omitting a value would
    // fail a library for the harness's limit.
    const testCase = { ...conformanceCase("c"), expectedValues: { q: "blue" } };
    expect(score(testCase, acceptedWithUnreadable({}, unreadable))).toBe("passValuesUnreadable");
  });

  it("still scores the values it did report", () => {
    // Only the named parameter is withheld. A case expecting a value this
    // container did read is compared as it always was, so the field cannot be
    // used to opt out of the value half wholesale.
    const testCase = { ...conformanceCase("c"), expectedValues: { p: "blue" } };
    expect(score(testCase, acceptedWithUnreadable({ p: "blue" }, unreadable))).toBe("pass");
    expect(score(testCase, acceptedWithUnreadable({ p: "red" }, unreadable))).toBe("failValue");
  });

  it("does not let an unreadable name mask a value that failed", () => {
    // Both orders, because the score must not depend on the order the case
    // writes `expectedValues`: an unreadable name met first must not hide an
    // attributable failure met second.
    const answer = acceptedWithUnreadable({ p: "red" }, unreadable);
    expect(score({ ...conformanceCase("c"), expectedValues: { p: "blue", q: "x" } }, answer)).toBe(
      "failValue",
    );
    expect(score({ ...conformanceCase("c"), expectedValues: { q: "x", p: "blue" } }, answer)).toBe(
      "failValue",
    );
  });

  it("withholds only when every expected value it could compare matched", () => {
    const answer = acceptedWithUnreadable({ p: "blue" }, unreadable);
    expect(score({ ...conformanceCase("c"), expectedValues: { q: "x", p: "blue" } }, answer)).toBe(
      "passValuesUnreadable",
    );
  });

  it("is named in the value cell rather than left out of it", () => {
    // Absent from `value` is what a library reporting nothing looks like, so a
    // cell printing only the values it has says that when this is true instead.
    expect(valuesText(acceptedWithUnreadable({ p: "blue" }, unreadable))).toBe(
      '{"p":"blue"} (handed to the handler), and this container could not read q ' +
        "(this library's request shape has no slot for it)",
    );
  });

  it("reads as an ordinary value cell when there is none", () => {
    expect(valuesText(accepted({ p: "blue" }))).toBe('{"p":"blue"} (handed to the handler)');
  });

  it("is named with its reason in the rendered matrix", () => {
    // The markdown path formats this separately from the cell above, so it is
    // asserted separately. A divergence case is the one that prints a value
    // table per library, which is where a reader meets this.
    const testCase = divergenceCase("cookie-form-array-duplicate-name-oas31");
    const artifacts = renderMarkdown(
      [testCase],
      [measurement("lib", "1.0.0", { [testCase.id]: acceptedWithUnreadable({ p: "blue" }, unreadable) })],
    );
    const matrix = artifacts["matrix.oas31.md"] ?? "";
    expect(matrix).toContain("this container could not read `q`");
    expect(matrix).toContain("this library's request shape has no slot for it");
  });
});

/**
 * Every table row has as many cells as its header.
 *
 * Checked on output rather than by comparing bytes against a committed file,
 * because a byte comparison certifies whatever was committed, including a row
 * a stray `|` already split.
 */
function misalignedRows(markdown: string): string[] {
  const cells = (line: string): number => line.split(/(?<!\\)\|/).length;
  const bad: string[] = [];
  let header: number | null = null;
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) {
      header = null;
      continue;
    }
    if (header === null) header = cells(line);
    else if (cells(line) !== header) bad.push(line);
  }
  return bad;
}

describe("rendered tables stay rectangular whatever a library reports", () => {
  it("escapes a pipe in a reported value", () => {
    const testCase = divergenceCase("query-pipe-delimited-object-canonical-oas31");
    const artifacts = renderMarkdown(
      [testCase],
      [measurement("lib", "1.0.0", { [testCase.id]: accepted({ p: "R|100|G|200" }) })],
    );
    for (const [name, markdown] of Object.entries(artifacts)) {
      expect({ name, bad: misalignedRows(markdown) }).toEqual({ name, bad: [] });
    }
  });
});

describe("the report never charges the library for the harness", () => {
  it("counts a harness error apart from the library raising", () => {
    const harnessError: AdapterResult = {
      library: "lib",
      libraryVersion: "1.0.0",
      configurationId: "fixture",
      preparse: null,
      outcome: "adapterError",
      detail: "container unreachable",
      raw: null,
    };
    const artifacts = renderMarkdown(cases, [
      measurement("lib", "1.0.0", { a: harnessError, b: raised() }),
    ]);
    const row = (artifacts["capabilities.md"] ?? "")
      .split("\n")
      .find((line) => line.startsWith("| `lib` | 0 |"));
    // decided, observed, withheld, unexposed, not reached, never asked, raised, harness error
    expect(row).toBe("| `lib` | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |");
  });
});

describe("fitness claims a split only where the measurements show one", () => {
  it("says the libraries did not split when they answered alike", () => {
    const testCase: DivergenceCase = {
      ...divergenceCase("cookie-form-object-explode-oas31"),
      dimensions: {
        location: "cookie",
        schema: "object",
        probeAxis: "canonical",
        declaration: "schema",
        style: "form",
        explode: true,
        declaredStyle: "form",
        declaredExplode: true,
      },
    };
    const disclaiming = (library: string): LibraryMeasurement => {
      const base = measurement(library, "1.0.0", { [testCase.id]: rejected() });
      return {
        ...base,
        capabilities: {
          ...base.capabilities,
          // A canonical case probes style deserialization, so disclaiming it is
          // what puts the case under this library's delegated stages.
          stages: { ...base.capabilities.stages, styleDeserialization: false },
        },
      };
    };
    const fitness =
      renderMarkdown([testCase], [disclaiming("one"), disclaiming("two")])["fitness.md"] ?? "";
    expect(fitness).not.toContain("measured implementations disagree");
    expect(fitness).toContain("did not split on them");
  });
});

describe("the reasons the prose names are reasons a result can carry", () => {
  it("names only unsupported reasons that exist", () => {
    const reasons: readonly UnsupportedReason[] = [
      "stageNotOwned",
      "harnessInputUnavailable",
      "oasVersionNotDeclared",
      "cannotRepresentCase",
      "libraryInitUnsupported",
      "adapterLimitation",
    ];
    const artifacts = renderMarkdown(cases, [measurement("lib", "1.0.0", {})]);
    for (const [name, content] of Object.entries(artifacts)) {
      for (const [, reason] of content.matchAll(/(?:not asked|n\/a) \(([A-Za-z]+)\)/g)) {
        expect({ name, reason, known: reasons.includes(reason as UnsupportedReason) }).toEqual({
          name,
          reason,
          known: true,
        });
      }
    }
  });
});

describe("markdown over two measurements of one library", () => {
  // Two versions of one package, from two containers. Every column is one
  // measurement, so nothing may be looked up by the package name they share.
  const withSlug = (base: LibraryMeasurement, slug: string): LibraryMeasurement => ({
    ...base,
    provenance: { ...base.provenance, slug },
  });
  const older = withSlug(
    measurement("same", "1.0.0", { a: accepted({ p: "blue" }), b: rejected() }),
    "same-old",
  );
  const newer = withSlug(
    measurement("same", "2.0.0", {
      a: rejected(),
      b: {
        library: "same",
        libraryVersion: "2.0.0",
        configurationId: "fixture",
        preparse: null,
        outcome: "accepted",
        deserialized: {
          kind: "observed",
          vantage: "parsedBeforeValidation",
          value: { p: "blue" },
          nativeTypes: {},
        },
        inputMutation: { kind: "none", detail: "fixture" },
        raw: null,
      },
    }),
    "same-new",
  );

  it("draws each measurement's own answer in its own column", () => {
    const matrix = renderMarkdown(cases, [newer, older])["matrix.oas31.md"] ?? "";
    expect(matrix).toContain("| case | expected | `same 1.0.0` | `same 2.0.0` |");
    const row = (id: string): string =>
      matrix.split("\n").find((line) => line.startsWith(`| [\`${id}\`]`)) ?? "";
    expect(row("a")).toContain("| accepted | pass | FAIL (verdict) |");
    expect(row("b")).toContain("| accepted | FAIL (verdict) | pass |");
  });

  it("writes one page per measurement", () => {
    const artifacts = renderMarkdown(cases, [older, newer]);
    expect(artifacts["libraries/same-old.md"]).toContain("Version measured: 1.0.0");
    expect(artifacts["libraries/same-new.md"]).toContain("Version measured: 2.0.0");
  });

  it("reads each measurement's vantages from its own answers", () => {
    const capabilities = renderMarkdown(cases, [older, newer])["capabilities.md"] ?? "";
    expect(capabilities).toContain("| `same 1.0.0` | yes | `handed to the handler` | yes |");
    expect(capabilities).toContain("| `same 2.0.0` | yes | `parsed before validation` | yes |");
  });

  it("refuses two measurements that would write the same page", () => {
    expect(() => renderMarkdown(cases, [older, withSlug(newer, "same-old")])).toThrow(
      "two measurements share the slug same-old",
    );
  });
});

describe("markdown over measurements of different corpora", () => {
  const one = measurement("one", "1.0.0", { a: accepted({ p: "blue" }) }, { corpusDigest: "sha256:one" });
  const two = measurement("two", "1.0.0", { a: accepted({ p: "blue" }) }, { corpusDigest: "sha256:two" });

  it("says so at the top of every file that reads the measurements", () => {
    const artifacts = renderMarkdown(cases, [one, two]);
    for (const name of ["README.md", "matrix.oas31.md", "fitness.md", "capabilities.md", "libraries/one.md"]) {
      const [title, blank, warning] = (artifacts[name] ?? "").split("\n");
      expect({ name, title: title?.startsWith("# "), blank, warning }).toMatchObject({
        name,
        title: true,
        blank: "",
        warning: expect.stringContaining("answered different corpora") as unknown,
      });
    }
    expect(artifacts["coverage.oas31.md"]).not.toContain("answered different corpora");
  });

  it("says nothing when they agree", () => {
    const artifacts = renderMarkdown(cases, [one, { ...two, corpusDigest: "sha256:one" }]);
    for (const content of Object.values(artifacts)) {
      expect(content).not.toContain("answered different corpora");
    }
  });
});

describe("a case withheld and a case with no answer read differently", () => {
  const withheld: AdapterResult = {
    library: "lib",
    libraryVersion: "1.0.0",
    configurationId: "fixture",
    preparse: null,
    outcome: "unsupported",
    reason: "stageNotOwned",
    detail: "fixture",
  };
  // `a` withheld by the runner, `b` absent from the measurement altogether.
  const measured = measurement("lib", "1.0.0", { a: withheld });

  it("says so in the markdown matrix, and defines both", () => {
    const matrix = renderMarkdown(cases, [measured])["matrix.oas31.md"] ?? "";
    const row = (id: string): string =>
      matrix.split("\n").find((line) => line.startsWith(`| [\`${id}\`]`)) ?? "";
    expect(row("a")).toContain("| n/a (stageNotOwned) |");
    expect(row("b")).toContain("| no answer |");
    expect(matrix).toContain("| `n/a (<reason>)` |");
    expect(matrix).toContain("| `no answer` |");
  });

  it("says so on the library's own page", () => {
    const page = renderMarkdown(cases, [measured])["libraries/lib.md"] ?? "";
    expect(page).toContain("#### Cases it was not asked");
    expect(page).toContain("#### Cases this measurement holds no answer for");
  });

  it("says so on the page, reason and all", () => {
    const html = renderHtml(cases, [{ label: "lib", measurement: measured }]);
    expect(html).toContain('>n/a</span><span class="why">stageNotOwned</span>');
    expect(html).toContain(">no answer</span>");
  });
});
