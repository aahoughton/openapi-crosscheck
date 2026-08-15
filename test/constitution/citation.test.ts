import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { externalFigures } from "../../src/corpus/provenance";
import { cases } from "../../src/corpus/index";

/**
 * The type system already makes a conformance case without a citation fail to
 * compile. This checks the part types cannot: that the citation is populated
 * rather than present, and that its quoted text is on the loaded case object so
 * a report row can carry it without anyone following an import to verify it.
 */
describe("conformance cases carry a citation", () => {
  const conformance = cases.filter((c) => c.tier === "conformance");

  it("cites at least one rule", () => {
    expect(conformance.filter((c) => c.citations.length === 0).map((c) => c.id)).toEqual([]);
  });

  it("populates anchor, url and quoted text in every citation", () => {
    const incomplete = conformance
      .filter((c) =>
        c.citations.some(
          (citation) =>
            citation.anchor.trim() === "" ||
            citation.url.trim() === "" ||
            citation.quoted.trim() === "",
        ),
      )
      .map((c) => c.id);
    expect(incomplete).toEqual([]);
  });

  it("cites the version the case declares", () => {
    const mismatched = conformance
      .filter((c) => c.citations.some((citation) => citation.oasVersion !== c.oasVersion))
      .map((c) => c.id);
    expect(mismatched).toEqual([]);
  });

  it("cites the rule connecting the style field to serialization wherever a row is quoted", () => {
    // A Style Examples row gives the wire form for one style, explode and type.
    // What makes that row the one this parameter is serialized by is the style
    // field, so a case quoting the row and not the field has left the step from
    // the declaration to the row unquoted.
    const missing = conformance
      .filter((c) => c.citations.some((citation) => citation.anchor === "style-examples"))
      .filter((c) => !c.citations.some((citation) => citation.anchor === "parameter-style"))
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("cites the rule that resolves style when the case leaves style unset", () => {
    // A case relying on the default style is asserting the default, so the text
    // stating the default has to be among its quotes.
    const missing = conformance
      .filter(
        (c) => c.dimensions.declaration === "schema" && c.dimensions.declaredStyle === "unset",
      )
      .filter((c) => !c.citations.some((citation) => citation.anchor === "parameter-style"))
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });
});

/**
 * The plain sentence every case carries, held to the shape that makes it
 * useful.
 *
 * It exists because the corpus's other prose answers "is this verdict right",
 * and a reader scanning a matrix is asking "what is this one doing". The
 * pressure on a field like that is to grow into a second rationale, which is
 * the thing it was added to replace, so the length is a test rather than an
 * intention.
 *
 * Naming a library would be the worse failure and is not checked here: the
 * corpus is above the adapter layer, so `no-privilege.test.ts` already polices
 * every string in it.
 */
describe("the plain sentence on every case", () => {
  it("is present and says something", () => {
    expect(cases.filter((c) => c.inShort.trim() === "").map((c) => c.id)).toEqual([]);
  });

  it("stays short enough to read on a hover", () => {
    // Two sentences at most. Long enough to say what arrives and what the case
    // watches for, too short to argue.
    const long = cases
      .filter((c) => c.inShort.length > 200)
      .map((c) => `${c.id} (${String(c.inShort.length)})`);
    expect(long).toEqual([]);
  });

  it("is ASCII, like everything else this project generates", () => {
    const nonAscii = cases.filter((c) => !/^[\x20-\x7e]*$/.test(c.inShort)).map((c) => c.id);
    expect(nonAscii).toEqual([]);
  });

  it("does not restate the case id, which the reader can already see", () => {
    const restated = cases.filter((c) => c.inShort.toLowerCase().includes(c.id)).map((c) => c.id);
    expect(restated).toEqual([]);
  });
});

describe("divergence cases carry no oracle", () => {
  it("stores no expected verdict", () => {
    for (const testCase of cases.filter((c) => c.tier === "divergence")) {
      expect(testCase).not.toHaveProperty("expected");
    }
  });
});

describe("case ids", () => {
  it("are unique and in ASCII order", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});

describe("figures this repository did not measure", () => {
  it("appear only in the labelled provenance section", () => {
    // Every other number in the report traces to the per-library measurement
    // JSON. An external figure sitting next to measurements reads as one of
    // them, so the matrix, which is where the measurements are, must not carry
    // any.
    const matrix = readFileSync(
      join(fileURLToPath(new URL("../..", import.meta.url)), "report/matrix.oas31.md"),
      "utf8",
    );
    const leaked = externalFigures.flatMap((figure) =>
      figure.figures.filter((value) => matrix.includes(value)),
    );
    expect(leaked).toEqual([]);
  });

  it("cannot claim to have been reproduced here", () => {
    for (const figure of externalFigures) {
      expect(figure.reproducedHere).toBe(false);
      expect(figure.toReproduce.trim()).not.toBe("");
    }
  });
});
