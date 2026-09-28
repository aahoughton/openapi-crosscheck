import type { JsonValue } from "../types/json";
import type { ConformanceCase } from "../types/case";
import type { AdapterResult } from "../types/result";

/**
 * What a conformance case says about one library.
 *
 * Three outcomes pass on the verdict with the value half unanswered, and they
 * are kept apart because each is a different fact:
 *
 * - `passVerdictOnly`: the library has no call that exposes deserialized
 *   values, so the value half could not be asked of it.
 * - `passValuesNotReached`: the library has such a call and reported reaching
 *   no values on this request.
 * - `passValuesUnreadable`: the container could not read at least one expected
 *   parameter, and every expected value it could read matched.
 *
 * `adapterError` belongs to the adapter or harness.
 */
export type ConformanceOutcome =
  | "pass"
  | "libraryError"
  | "passVerdictOnly"
  | "passValuesNotReached"
  | "passValuesUnreadable"
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
  // The verdict is right and the answer holds no values to compare. Scoring it
  // `failValue` would read "reached no values" as "handed back wrong values",
  // which the observation does not say, and the reason beside it may name the
  // container's reach as easily as the library's. It passes on the verdict
  // under an outcome of its own, so a reader sees that the value half went
  // unanswered for this reason and no other.
  if (result.deserialized.kind === "notReached") return "passValuesNotReached";

  const observed = result.deserialized.value;
  const unreadable = result.deserialized.unreadable ?? {};

  // Every expected name is compared before anything is returned, and a real
  // failure outranks an unreadable one, so the score does not depend on the
  // order the case writes `expectedValues`.
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
  return withheld ? "passValuesUnreadable" : "pass";
}

export function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index] ?? null));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    if (Array.isArray(a) || Array.isArray(b)) return false;
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
