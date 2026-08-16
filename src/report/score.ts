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
  const unreadable = result.deserialized.unreadable ?? {};

  // Every expected name is compared before anything is returned, and a real
  // failure outranks an unreadable one. Returning on the first unreadable name
  // instead made the score depend on the order the case wrote `expectedValues`:
  // with one name failing and another unreadable, `{failing, unreadable}`
  // scored failValue and `{unreadable, failing}` scored passVerdictOnly, so a
  // library's attributable failure was masked by a key order nothing about the
  // measurement should turn on.
  let withheld = false;
  for (const [name, expected] of Object.entries(testCase.expectedValues)) {
    // A parameter this container could not read is the whole-case `unexposed`
    // answer narrowed to one name: the value half could not be asked of it, so
    // it neither passes nor fails. Comparing it would read the container's gap
    // as the library omitting a value and fail it for the harness's reach.
    if (Object.hasOwn(unreadable, name)) {
      withheld = true;
      continue;
    }
    // Presence first. Collapsing a missing key into null would score a library
    // that omitted the parameter the same as one that returned null for it,
    // and nullable schemas are exactly where that distinction carries the case.
    if (!Object.hasOwn(observed, name)) return "failValue";
    const value = observed[name];
    if (value === undefined || !deepEqual(value, expected)) return "failValue";
  }
  return withheld ? "passVerdictOnly" : "pass";
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
