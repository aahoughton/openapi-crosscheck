import type { InputMutation } from "../types/result";

/**
 * Whether the library wrote back onto the input it was handed.
 *
 * Take a snapshot before the call, compare after it. A validator built on a
 * coercing schema engine can hand deserialized values back in band, by writing
 * them onto the object its caller passed, and a caller reading that object
 * afterwards is reading a real value channel. Nothing else in the protocol can
 * see that: the container is the only side holding the object.
 *
 * Structural rather than by reference, and key order is not a difference: an
 * object rebuilt with the same content is the same input as far as a caller is
 * concerned, and reporting it as a mutation would be a false positive on the
 * one check whose whole value is that it fires only when something happened.
 */
export function snapshotInput<T>(value: T): T {
  return structuredClone(value);
}

export function inputMutation(before: unknown, after: unknown, scope: string): InputMutation {
  const changed = differingKeys(before, after);
  if (changed.length === 0) return { kind: "none", detail: `${scope}, unchanged` };
  return {
    kind: "observed",
    detail: `${scope}; changed: ${changed.map((key) => `${key} is now ${show(after, key)} where it was ${show(before, key)}`).join(", ")}`,
  };
}

function differingKeys(before: unknown, after: unknown): string[] {
  if (!isRecord(before) || !isRecord(after)) return deepEqual(before, after) ? [] : ["input"];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !deepEqual(before[key], after[key])).sort();
}

function show(value: unknown, key: string): string {
  const held = isRecord(value) ? value[key] : undefined;
  const text = JSON.stringify(held) ?? "undefined";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Structural equality, exported so an adapter can compare the value at one
 * declared parameter position across the same before/after pair this module
 * diffs whole. Both readings must agree on what "changed" means, so there is
 * one definition.
 */
export function deepEqual(one: unknown, other: unknown): boolean {
  if (Object.is(one, other)) return true;
  if (Array.isArray(one) || Array.isArray(other)) {
    if (!Array.isArray(one) || !Array.isArray(other) || one.length !== other.length) return false;
    return one.every((item, index) => deepEqual(item, other[index]));
  }
  if (!isRecord(one) || !isRecord(other)) return false;
  const keys = new Set([...Object.keys(one), ...Object.keys(other)]);
  return [...keys].every((key) => deepEqual(one[key], other[key]));
}
