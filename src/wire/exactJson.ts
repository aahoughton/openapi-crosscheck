/**
 * JSON parsing that refuses a number it cannot hold.
 *
 * A JavaScript number is an IEEE 754 double, and `JSON.parse` rounds any
 * literal outside that set without saying so: `9007199254740993` becomes
 * `9007199254740992`, and `1e400` becomes `Infinity`, which is then written to
 * disk as `null`. A container's answer is stored as the measurement, so a
 * rounded value is a cell claiming the library returned something it did not.
 * The scorer compares rounded expected values with rounded observed ones, so a
 * library that lost the precision itself would also pass.
 *
 * The harness therefore cannot measure a case whose answer carries such a
 * number, and says so by failing the run rather than storing it.
 *
 * A literal is held when its decimal value equals that of the double's own
 * spelling, `String(value)`, which is what the measurement file will carry. So
 * `1.0`, `1e0` and `1` are all held as `1`, and `0.1` is held because it is
 * written back as `0.1`, though the double nearest it is not 0.1 exactly.
 * Negative zero is written back as `0` and is accepted as equal, the same as
 * JSON Schema's equality by mathematical value.
 */
export class InexactNumber extends Error {
  override readonly name = "InexactNumber";
}

/** A literal the reviver could not hold, kept in place so its path can be named. */
class Unheld {
  constructor(readonly source: string) {}
}

/**
 * Parse `text`, or throw `InexactNumber` naming every number `JSON.parse`
 * would have changed. `what` prefixes the message and says whose answer it was.
 *
 * Malformed JSON throws the `SyntaxError` `JSON.parse` throws.
 */
export function parseExact(text: string, what: string): unknown {
  const parsed: unknown = JSON.parse(
    text,
    (_key, value: unknown, context?: { source?: string }) => {
      if (typeof value !== "number") return value;
      // JSON.parse hands a reviver the source text from Node 21 on. Without it
      // nothing here can be checked, and accepting every number would turn the
      // refusal off with no sign that it had.
      if (context?.source === undefined) {
        throw new Error(
          `JSON.parse gave no source text for a number (Node ${process.version}); ` +
            "the harness needs Node 24, as pinned in mise.toml",
        );
      }
      return holds(context.source, value) ? value : new Unheld(context.source);
    },
  );
  const found: string[] = [];
  collect(parsed, "$", found);
  if (found.length > 0) {
    throw new InexactNumber(
      `${what} carried ${found.join(", ")}, which a JavaScript number cannot hold exactly. ` +
        `The harness cannot store this answer as given, so it cannot measure this case.`,
    );
  }
  return parsed;
}

function collect(value: unknown, path: string, found: string[]): void {
  if (value instanceof Unheld) {
    found.push(`${value.source} at ${path}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, `${path}[${String(index)}]`, found));
  } else if (typeof value === "object" && value !== null) {
    for (const [key, member] of Object.entries(value)) {
      collect(
        member,
        /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`,
        found,
      );
    }
  }
}

/** Whether the double `value` denotes the decimal value `source` writes. */
function holds(source: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return decimal(source) === decimal(String(value));
}

/**
 * A decimal literal reduced to one spelling: sign, significant digits with no
 * leading or trailing zeros, and the exponent of the last digit. Zero of either
 * sign is `0`. Accepts JSON's number grammar and what `String(number)` writes.
 */
function decimal(literal: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(literal);
  if (match === null) throw new Error(`not a decimal literal: ${literal}`);
  const [, sign = "", whole = "", fraction = "", exponent = "0"] = match;
  let digits = `${whole}${fraction}`.replace(/^0+/, "");
  let scale = Number(exponent) - fraction.length;
  if (digits === "") return "0";
  const trimmed = digits.replace(/0+$/, "");
  scale += digits.length - trimmed.length;
  digits = trimmed;
  return `${sign}${digits}e${String(scale)}`;
}
