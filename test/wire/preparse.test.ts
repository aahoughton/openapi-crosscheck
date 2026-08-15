import { describe, expect, it } from "vitest";
import { STRING } from "../../src/corpus/build";
import { document } from "../../src/corpus/cases/oas31/build";
import { describePreparse, preparse } from "../../src/wire/preparse";

describe("query preparse", () => {
  it("splits raw query pairs without decoding or collapsing them", () => {
    const parsed = preparse(
      document([{ name: "p", in: "query", required: true, schema: STRING }], "/t"),
      {
        method: "GET",
        target: "/t?p=a%2Fb&p=a+b&encoded%5Bkey%5D=value?kept&empty",
        headers: [["Host", "harness.invalid"]],
      },
      { cookie: false, header: false, path: false, query: true },
    );

    expect(parsed.query).toEqual([
      ["p", "a%2Fb"],
      ["p", "a+b"],
      ["encoded%5Bkey%5D", "value?kept"],
      ["empty", ""],
    ]);
    expect(describePreparse(parsed).description).toContain(
      "no style interpretation or percent decoding",
    );
  });
});
