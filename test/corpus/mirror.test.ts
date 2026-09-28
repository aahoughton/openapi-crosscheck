import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import type { Case } from "../../src/types/case";

/**
 * The 3.0 and 3.1 case sets mirror each other.
 *
 * 3.0.4 and 3.1.1 share a Style Examples table, the appendices and the Paths
 * Object text, so a 3.1 case asks a 3.0 question with the same bytes and the
 * same answer unless the schema dialect is what differs. A twin edited on one
 * side only turns a version comparison into a comparison of two different
 * questions, and nothing else would notice.
 *
 * Every departure is listed below with its reason, and the list is checked in
 * both directions: a difference not listed fails, and a listed difference that
 * no longer exists fails.
 */

const COMPARED = [
  "document",
  "request",
  "dimensions",
  "tier",
  "expected",
  "expectedValues",
] as const;
type Compared = (typeof COMPARED)[number];

/** Cases with no twin in the other version, by full id. */
const VERSION_SPECIFIC: Readonly<Record<string, string>> = {
  "query-form-scalar-type-array-oas30":
    "3.0 requires type to be one string, so a type array is a 3.0 document rule. " +
    "Under 3.1 it is the ordinary spelling of a union.",
  "query-content-json-scalar-type-array-literal-oas31":
    "The 3.1 spelling of a nullable string. Its 3.0 spelling is the nullable keyword, " +
    "asked by query-content-json-scalar-nullable-literal-oas30.",
};

/** Twins that differ on purpose, by id without the version suffix. */
const INTENDED: Readonly<Record<string, { fields: readonly Compared[]; why: string }>> = {
  "query-content-json-scalar-nullable-literal": {
    fields: ["dimensions", "expected", "expectedValues"],
    why:
      "The same document and value under two dialects. 3.0's nullable admits null; " +
      "2020-12 reads nullable as an annotation, so under 3.1 null is a wrong type " +
      "for string.",
  },
  "query-form-scalar-nullable-absent": {
    fields: ["document"],
    why: "Each version spells a nullable string in its own dialect.",
  },
  "query-form-scalar-nullable-empty": {
    fields: ["document"],
    why: "Each version spells a nullable string in its own dialect.",
  },
  "query-form-scalar-nullable-literal": {
    fields: ["document"],
    why: "Each version spells a nullable string in its own dialect.",
  },
};

const SUFFIX = /-oas3([01])$/;

function stem(id: string): string {
  return id.replace(SUFFIX, "");
}

function comparable(testCase: Case): Record<Compared, unknown> {
  const { openapi: _openapi, ...document } = testCase.document;
  return {
    document,
    request: testCase.request,
    dimensions: testCase.dimensions,
    tier: testCase.tier,
    expected: testCase.tier === "conformance" ? testCase.expected : undefined,
    expectedValues: testCase.tier === "conformance" ? testCase.expectedValues : undefined,
  };
}

const oas30 = new Map(
  cases.filter((c) => c.id.endsWith("-oas30")).map((c) => [stem(c.id), c] as const),
);
const oas31 = new Map(
  cases.filter((c) => c.id.endsWith("-oas31")).map((c) => [stem(c.id), c] as const),
);

describe("the 3.0 and 3.1 cases mirror each other", () => {
  it("gives every case a twin unless it is listed as version-specific", () => {
    const unpaired = [
      ...[...oas30.values()].filter((c) => !oas31.has(stem(c.id))),
      ...[...oas31.values()].filter((c) => !oas30.has(stem(c.id))),
    ]
      .map((c) => c.id)
      .sort();
    expect(unpaired).toEqual(Object.keys(VERSION_SPECIFIC).sort());
  });

  it("keeps each twin equal outside the listed differences", () => {
    const differences: Record<string, Compared[]> = {};
    for (const [key, earlier] of oas30) {
      const later = oas31.get(key);
      if (later === undefined) continue;
      const a = comparable(earlier);
      const b = comparable(later);
      const differing = COMPARED.filter(
        (field) => JSON.stringify(a[field]) !== JSON.stringify(b[field]),
      );
      if (differing.length > 0) differences[key] = differing;
    }
    const intended = Object.fromEntries(
      Object.entries(INTENDED).map(([key, entry]) => [key, [...entry.fields]]),
    );
    expect(differences).toEqual(intended);
  });

  it("uses the same version string throughout a case", () => {
    for (const testCase of [...oas30.values(), ...oas31.values()]) {
      const version = testCase.id.endsWith("-oas30") ? "3.0" : "3.1";
      expect({ id: testCase.id, version: testCase.oasVersion }).toEqual({
        id: testCase.id,
        version,
      });
      expect(testCase.document.openapi.startsWith(`${version}.`)).toBe(true);
    }
  });
});
