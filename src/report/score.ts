import type { JsonValue } from "../types/json";
import type { ConformanceCase } from "../types/case";
import type { AdapterResult } from "../types/result";

/**
 * What a conformance case says about one library.
 *
 * `passVerdictOnly` exists so that a library which exposes no deserialized
 * values is scored on what it can be asked, rather than failed for a capability
 * it never claimed. `adapterError` belongs to the adapter or harness.
 */
export type ConformanceOutcome =
  | "pass"
  | "libraryError"
  | "passVerdictOnly"
  | "failVerdict"
  | "failValue"
  | "notApplicable"
  | "adapterError";

export function score(testCase: ConformanceCase, result: AdapterResult): ConformanceOutcome {
  if (result.outcome === "unsupported") return "notApplicable";
  if (result.outcome === "adapterError") return "adapterError";
  // A raise is not a verdict, so it can never satisfy an expected one.
  if (result.outcome === "libraryError") return "libraryError";
  if (result.outcome !== testCase.expected) return "failVerdict";

  if (testCase.expectedValues === null) return "pass";
  if (result.deserialized.kind === "unexposed") return "passVerdictOnly";
  if (result.deserialized.kind === "notReached") return "passVerdictOnly";

  const observed = result.deserialized.value;
  for (const [name, expected] of Object.entries(testCase.expectedValues)) {
    // Presence first. Collapsing a missing key into null would score a library
    // that omitted the parameter the same as one that returned null for it,
    // and nullable schemas are exactly where that distinction carries the case.
    if (!Object.hasOwn(observed, name)) return "failValue";
    const value = observed[name];
    if (value === undefined || !deepEqual(value, expected)) return "failValue";
  }
  return "pass";
}

export function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index] ?? null));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || !aKeys.every((key, i) => key === bKeys[i])) return false;
    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, JsonValue>)[key] ?? null,
        (b as Record<string, JsonValue>)[key] ?? null,
      ),
    );
  }
  return false;
}
