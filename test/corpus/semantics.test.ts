import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import { score } from "../../src/report/score";
import type { ConformanceCase } from "../../src/types/case";
import type { DeserializedValues } from "../../src/types/result";

function conformance(id: string): ConformanceCase {
  const testCase = cases.find((entry) => entry.id === id);
  if (testCase?.tier !== "conformance") throw new Error(`expected conformance case: ${id}`);
  return testCase;
}

function reading(
  testCase: ConformanceCase,
  outcome: "accepted" | "rejected",
  value: DeserializedValues,
) {
  return score(testCase, {
    library: "fixture",
    libraryVersion: "0",
    configurationId: "counterexample",
    preparse: null,
    outcome,
    deserialized: { kind: "observed", vantage: "parsedBeforeValidation", value, nativeTypes: {} },
    inputMutation: { kind: "none", detail: "fixture" },
    raw: null,
  });
}

for (const version of ["30", "31"]) {
  describe(`serialization and routing controls, oas${version}`, () => {
    it("distinguishes delimiter splitting from decoding data", () => {
      const family = ["canonical", "encoded-delimiter"].map((axis) =>
        conformance(`path-simple-array-${axis}-oas${version}`),
      );
      const splitFirst = family.map((entry) => {
        const segment = entry.request.target.slice("/t/".length);
        return reading(entry, "accepted", { p: segment.split(",").map(decodeURIComponent) });
      });
      const decodeFirst = family.map((entry) => {
        const segment = entry.request.target.slice("/t/".length);
        return reading(entry, "accepted", { p: decodeURIComponent(segment).split(",") });
      });
      expect(splitFirst).toEqual(["pass", "pass"]);
      expect(decodeFirst).toEqual(["pass", "failValue"]);
    });

    it("preserves the ordered combined value of repeated array headers", () => {
      const canonical = conformance(`header-simple-array-canonical-oas${version}`);
      const repeated = conformance(`header-simple-array-duplicate-name-oas${version}`);
      expect(repeated.document).toEqual(canonical.document);
      const fieldValues = (entry: ConformanceCase) =>
        entry.request.headers
          .filter(([name]) => name.toLowerCase() === "p")
          .map(([, value]) => value);
      const lines = fieldValues(repeated);
      expect(lines.join(",")).toBe(fieldValues(canonical).join(","));
      expect(reading(repeated, "accepted", { p: lines })).toBe("pass");
      expect(reading(repeated, "accepted", { p: lines.slice(0, 1) })).toBe("failValue");
      expect(reading(repeated, "accepted", { p: [...lines].reverse() })).toBe("failValue");
    });

    it("defeats insertion-order routing and unconditional rejection", () => {
      const family = cases.filter(
        (entry): entry is ConformanceCase =>
          entry.tier === "conformance" &&
          entry.id.startsWith("path-routing-concrete-before-templated") &&
          entry.id.endsWith(`-oas${version}`),
      );
      expect(family).toHaveLength(4);
      function route(entry: ConformanceCase, policy: "first" | "last" | "concrete") {
        const url = new URL(entry.request.target, "http://fixture.invalid");
        const matches = Object.entries(entry.document.paths).filter(([path]) =>
          new RegExp(`^${path.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(url.pathname),
        );
        if (policy === "last") matches.reverse();
        if (policy === "concrete")
          matches.sort(([a], [b]) => Number(a.includes("{")) - Number(b.includes("{")));
        const operation = matches[0]?.[1].get;
        if (operation === undefined) throw new Error("fixture request must match an operation");
        const missing = operation.parameters?.some(
          (parameter) =>
            parameter.in === "query" && parameter.required && !url.searchParams.has(parameter.name),
        );
        return reading(entry, missing === true ? "rejected" : "accepted", {});
      }
      expect(family.map((entry) => route(entry, "concrete"))).toEqual([
        "pass",
        "pass",
        "pass",
        "pass",
      ]);
      for (const policy of ["first", "last"] as const) {
        expect(family.filter((entry) => route(entry, policy) === "failVerdict")).toHaveLength(1);
      }
      expect(
        family.filter((entry) => reading(entry, "rejected", {}) === "failVerdict"),
      ).toHaveLength(2);
      // Each declaration order has a valid and invalid request for the same document.
      for (const first of ["/t/mine", "/t/{p}"]) {
        const pair = family.filter((entry) => Object.keys(entry.document.paths)[0] === first);
        expect(pair).toHaveLength(2);
        expect(pair[0]?.document).toEqual(pair[1]?.document);
        expect(new Set(pair.map((entry) => entry.expected))).toEqual(
          new Set(["accepted", "rejected"]),
        );
      }
    });

    it("uses typed JSON controls beside the open text-conversion cases", () => {
      for (const name of ["literal", "wrong-type"]) {
        const textCase = cases.find(
          (entry) => entry.id === `query-form-boolean-${name}-oas${version}`,
        );
        expect(textCase?.tier).toBe("divergence");
      }
      const valid = conformance(`query-content-json-boolean-canonical-oas${version}`);
      const invalid = conformance(`query-content-json-boolean-wrong-type-oas${version}`);
      expect(valid.document).toEqual(invalid.document);
      const parsed = [valid, invalid].map((entry) =>
        JSON.parse(
          new URL(entry.request.target, "http://fixture.invalid").searchParams.get("p") ?? "",
        ),
      ) as unknown[];
      expect(parsed).toEqual([true, "blue"]);
      expect(valid.expected).toBe("accepted");
      expect(invalid.expected).toBe("rejected");
      expect(reading(invalid, "accepted", { p: Boolean(parsed[1]) })).toBe("failVerdict");
    });
  });
}
