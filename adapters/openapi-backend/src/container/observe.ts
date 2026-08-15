import type { JsonValue } from "../types/json";
import type { DeserializedValues, NativeTypes, Observation, ValueVantage } from "../types/result";

/**
 * Name the JavaScript type of a value, the way JavaScript would name it.
 *
 * The point of `nativeTypes` is that languages disagree about numbers, so this
 * has to answer honestly rather than usefully. JavaScript has one number type,
 * so an integer-schema parameter and a number-schema one both come back
 * `number` here. A Python container answering the same question for the same
 * request says `int` and `float`. Neither is wrong and the difference is the
 * fact worth reporting.
 */
export function describeNativeType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    const elements = [...new Set(value.map(describeNativeType))].sort();
    // An empty container has no element type to report. Naming one anyway, or
    // emitting an empty pair of brackets, would both be inventions.
    return elements.length === 0 ? "Array" : `Array<${elements.join("|")}>`;
  }
  if (typeof value === "object") {
    const members = [...new Set(Object.values(value).map(describeNativeType))].sort();
    return members.length === 0 ? "Object" : `Object<string,${members.join("|")}>`;
  }
  return typeof value;
}

export function describeNativeTypes(values: DeserializedValues): NativeTypes {
  const types: NativeTypes = {};
  for (const [name, value] of Object.entries(values)) types[name] = describeNativeType(value);
  return types;
}

/**
 * Build an observed value channel with its native types filled in.
 *
 * Derived here rather than written by each adapter because for a JavaScript
 * container the native type is a property of the value, so deriving it centrally
 * is one implementation instead of four chances to describe it differently. A
 * container in another language derives it from its own values the same way.
 */
export function observed(
  vantage: ValueVantage,
  value: DeserializedValues,
): Observation<DeserializedValues> {
  return { kind: "observed", vantage, value, nativeTypes: describeNativeTypes(value) };
}
