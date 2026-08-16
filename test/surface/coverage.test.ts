import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { OasVersion } from "../../src/types/openapi";
import { OAS_VERSIONS } from "../../src/types/openapi";
import { cases } from "../../src/corpus/index";
import { coverage, declaredTypes } from "../../src/report/view";
import {
  CONTENT_MEDIA_TYPES,
  DECLARED_TYPES,
  cellKey,
  contentCellKey,
  definedContentSurface,
  definedSurface,
} from "../../src/surface/surface";

/**
 * A coverage map only means something when every case lands in it.
 *
 * The maps are enumerated from the specification rather than from the corpus,
 * which is what lets them show a hole. The cost of that choice is the opposite
 * failure: a case whose coordinates fall outside the enumeration is counted
 * nowhere, and the map reads as complete while the corpus contains something it
 * never mentioned. Neither table can detect that on its own, so it is asserted
 * here.
 */

// Per version, because the style surface is: a cookie-style cell is defined
// under 3.2 and under nothing earlier, so a case is placed against the surface
// of the specification it cites rather than against a union of all of them.
const definedStyleKeys = new Map<OasVersion, ReadonlySet<string>>(
  OAS_VERSIONS.map((version) => [version, new Set(definedSurface(version).map(cellKey))]),
);
const definedContentKeys = new Set(definedContentSurface().map(contentCellKey));

describe("every case lands in a coverage map", () => {
  it("places a schema case outside the style surface only as a divergence probe", () => {
    // The surface excludes combinations the Style Values table marks n/a, and
    // the report says those are probed as divergence cases instead. So a case
    // outside the surface is expected; a *conformance* case outside it is not,
    // because the specification calling a combination undefined is the reason
    // there is nothing to conform to.
    const stray = cases
      .flatMap((testCase) =>
        testCase.dimensions.declaration === "schema"
          ? [
              {
                id: testCase.id,
                tier: testCase.tier,
                version: testCase.oasVersion,
                key: cellKey(testCase.dimensions),
              },
            ]
          : [],
      )
      .filter(
        (entry) =>
          entry.tier === "conformance" &&
          !(definedStyleKeys.get(entry.version)?.has(entry.key) ?? false),
      )
      .map((entry) => entry.id);
    expect(stray).toEqual([]);
  });

  it("places every content case that sends a representation in an enumerated cell", () => {
    // Two kinds of content case fill no cell by design: one breaking a rule
    // addressed to the document's author, and one sending no value at all.
    // Everything else has to be somewhere. A case declaring a media type
    // outside `CONTENT_MEDIA_TYPES` fails here, and widening that axis or
    // accepting the case as unplaced is then a deliberate act rather than a
    // number quietly shrinking.
    const stray = cases
      .flatMap((testCase) => {
        const dimensions = testCase.dimensions;
        if (dimensions.declaration !== "content") return [];
        if (testCase.breaksDocumentRule !== undefined) return [];
        if (dimensions.probeAxis === "missingName") return [];
        return [
          {
            id: testCase.id,
            key: contentCellKey({
              location: dimensions.location,
              mediaType: dimensions.mediaType,
              schema: dimensions.schema,
              condition: dimensions.probeAxis === "foreignWireShape" ? "malformed" : "wellFormed",
            }),
          },
        ];
      })
      .filter((entry) => !definedContentKeys.has(entry.key))
      .map((entry) => entry.id);
    expect({ stray, enumerated: CONTENT_MEDIA_TYPES }).toEqual({
      stray: [],
      enumerated: CONTENT_MEDIA_TYPES,
    });
  });
});

/**
 * The type axis exists to show a hole, so what is asserted is that a hole shows.
 *
 * The corpus declared `string` or `integer` and nothing else for its whole life,
 * `boolean` appeared nowhere, and no published map could say so, because the
 * coverage tables enumerate how a value is written and the declared type is not
 * part of that. A row per type is only worth adding if an unprobed type is
 * visible in it.
 */
describe("the declared type axis shows what is missing", () => {
  const coverageMd = readFileSync(
    join(fileURLToPath(new URL("../..", import.meta.url)), "report/coverage.oas31.md"),
    "utf8",
  );

  it("gives every type the specification names a row of its own", () => {
    for (const type of DECLARED_TYPES) {
      expect(coverageMd).toContain(`| \`${type}\` |`);
    }
  });

  it("counts a type no case declares rather than leaving it out", () => {
    // The failure this prevents is a map built from the corpus, which is
    // complete by construction and says nothing. A type nobody probed has to
    // appear with a zero next to it.
    const view = coverage(cases);
    const undeclared = view.byType.filter((entry) => entry.declaredBy.length === 0);
    expect(undeclared.length).toBeGreaterThan(0);
    for (const entry of undeclared) {
      expect(coverageMd).toContain(`| \`${entry.type}\` | 0 |`);
    }
  });

  it("reads the types off the documents, including inside a container", () => {
    // A property's type is where the corpus was blindest, so the walk has to
    // reach into properties and items rather than reading the top-level type.
    const objectCase = cases.find((c) => c.id === "query-form-object-wrong-type-oas31");
    expect(objectCase).toBeDefined();
    if (objectCase === undefined) return;
    expect([...declaredTypes(objectCase.document)].sort()).toEqual(["integer", "string"]);
  });

  it("separates declaring a type from probing a value against it", () => {
    // Declaring a type shows a library the shape to accept. Only a wrong value
    // shows whether it checked. The two columns are different questions and the
    // second is the one that catches something.
    const view = coverage(cases);
    const declaredButUnprobed = view.byType.filter(
      (entry) => entry.declaredBy.length > 0 && entry.wrongValueBy.length === 0,
    );
    expect(view.byType.some((entry) => entry.wrongValueBy.length > 0)).toBe(true);
    // `string` is the one that cannot be probed: every value on the wire is
    // text, so there is nothing a string schema must refuse.
    for (const entry of declaredButUnprobed) {
      expect(entry.type).not.toBe("boolean");
    }
  });
});
