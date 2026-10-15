import { describe, expect, it, vi } from "vitest";
import { InexactNumber, parseExact } from "../../src/wire/exactJson";

describe("a number a double holds exactly is parsed as JSON.parse parses it", () => {
  it.each([
    ["1", 1],
    ["1.0", 1],
    ["1e2", 100],
    ["1E+2", 100],
    ["0.1", 0.1],
    ["-0", -0],
    ["0.000", 0],
    ["1.5e-7", 1.5e-7],
    ["9007199254740992", 9007199254740992],
    ["-9007199254740992", -9007199254740992],
    ["1e21", 1e21],
    ["123456789012345680000", 123456789012345680000],
    ["1.7976931348623157e308", Number.MAX_VALUE],
  ])("holds %s", (literal, expected) => {
    expect(parseExact(`{"n":${literal}}`, "test")).toEqual({ n: expected });
  });
});

describe("a number a double cannot hold is refused", () => {
  it.each([
    "9007199254740993",
    "-9007199254740993",
    "9223372036854775807",
    "1e400",
    "-1e400",
    "0.10000000000000000001",
    "123456789012345678901",
    "1e-400",
    "4.9e-324",
  ])("refuses %s", (literal) => {
    expect(() => parseExact(`{"n":${literal}}`, "test")).toThrow(InexactNumber);
  });

  it("names whose answer it was, and the path and literal of each number refused", () => {
    const text =
      '{"raw":{"errors":[{"limit":9223372036854775807}],"odd key":[1,1e400]},"value":{"p":1.5}}';
    expect(() => parseExact(text, "lib: /run for case-a")).toThrow(
      'lib: /run for case-a carried 9223372036854775807 at $.raw.errors[0].limit, 1e400 at $.raw["odd key"][1],',
    );
  });

  it("fails rather than accepting every number when JSON.parse gives no source text", () => {
    // What a runtime older than Node 21 does: the reviver gets no context.
    const original = JSON.parse.bind(JSON);
    const spy = vi
      .spyOn(JSON, "parse")
      .mockImplementation((text, reviver) =>
        original(text, reviver === undefined ? undefined : (key, value) => reviver(key, value)),
      );
    try {
      expect(() => parseExact('{"n":1}', "test")).toThrow("gave no source text");
    } finally {
      spy.mockRestore();
    }
  });

  it("leaves malformed JSON to fail as JSON.parse fails", () => {
    expect(() => parseExact("not json", "test")).toThrow(SyntaxError);
  });
});
