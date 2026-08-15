import type { JsonValue } from "../types/json";

/**
 * Convert arbitrary library output into something that can be stored and
 * compared across machines.
 *
 * Stack traces are dropped and the drop is marked. A stack embeds absolute
 * paths from whichever worktree produced it, so keeping it would make the
 * committed raw output differ between two people running the same commit, and
 * a report nobody else can regenerate is not traceable. A stack is a fact about
 * the machine rather than about the library's verdict. Everything the library
 * itself said (message, name, status, its own structured errors) is kept
 * unedited.
 */
export function toJsonValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "bigint":
      return String(value);
    case "function":
      return "[function]";
    case "symbol":
      return String(value);
    case "undefined":
      return null;
  }

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => toJsonValue(item, seen));

  if (value instanceof Error) {
    const error: Record<string, JsonValue> = {
      name: value.name,
      message: value.message,
      stackOmitted: true,
    };
    for (const key of Object.keys(value)) {
      if (key === "stack") continue;
      error[key] = toJsonValue((value as unknown as Record<string, unknown>)[key], seen);
    }
    return error;
  }

  const object: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "stack") {
      object["stackOmitted"] = true;
      continue;
    }
    object[key] = toJsonValue(entry, seen);
  }
  return object;
}
