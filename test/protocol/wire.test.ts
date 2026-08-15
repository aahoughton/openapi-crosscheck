import { describe, expect, it } from "vitest";
import { fromWireMessage, toWireMessage } from "../../src/container/wireMessage";
import type { WireRequest } from "../../src/types/wire";

/**
 * Targets a transport would mangle if it ever got to parse one.
 *
 * Every entry is something an HTTP client or server normalizes by default:
 * percent escapes get re-encoded or decoded, dot segments get resolved,
 * delimiters get rewritten. If the encoding round-trips these it round-trips
 * anything the corpus carries.
 */
const HOSTILE_TARGETS = [
  "/t/blue,black",
  "/t/blue%2Cblack",
  "/t/;p=blue;q=black",
  "/t/.blue.black",
  "/t/%2E%2E/%2E%2E/etc",
  "/t/a b",
  "/t/%00",
  "/t?p=1&p=2",
  "/t?p=a%26b",
  "/t?p=%E2%82%AC",
  "/t//double//slash",
  "/t/../up",
];

describe("the wire encoding round-trips what a transport would mangle", () => {
  for (const target of HOSTILE_TARGETS) {
    it(`preserves ${target} byte for byte`, () => {
      const request: WireRequest = {
        method: "GET",
        target,
        headers: [["Host", "harness.invalid"]],
      };
      expect(fromWireMessage(toWireMessage(request)).target).toBe(target);
    });
  }

  it("preserves duplicate header names, their order and their casing", () => {
    // All three are probe dimensions. A record collapses every one of them, and
    // the cases that depend on them would vanish without any test failing.
    const request: WireRequest = {
      method: "GET",
      target: "/t",
      headers: [
        ["X-P", "first"],
        ["x-p", "second"],
        ["X-p", "third"],
      ],
    };
    expect(fromWireMessage(toWireMessage(request)).headers).toEqual(request.headers);
  });
});
