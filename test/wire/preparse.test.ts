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
      // No `=` at all, which is a different request from `&empty=`.
      ["empty", null],
    ]);
    expect(describePreparse(parsed).description).toContain(
      "no style interpretation or percent decoding",
    );
  });
});

describe("a name that is also a property of every object", () => {
  const headerDocument = document(
    [{ name: "p", in: "header", required: true, schema: STRING }],
    "/t",
  );

  it("folds it like any other header name", () => {
    // `toString` and `__proto__` are legal header names. Read back off a plain
    // object, the first answers with the prototype's function and reads as a
    // repeat of a header that arrived once; the second sets the prototype
    // instead of a property and loses the value entirely.
    const parsed = preparse(
      headerDocument,
      {
        method: "GET",
        target: "/t",
        headers: [
          ["toString", "blue"],
          ["__proto__", "black"],
        ],
      },
      { cookie: false, header: true, path: false, query: false },
    );

    expect(parsed.headers).not.toBeNull();
    const headers = parsed.headers ?? {};
    expect(Object.hasOwn(headers, "tostring")).toBe(true);
    expect(headers["tostring"]).toBe("blue");
    expect(Object.hasOwn(headers, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype);
  });
});

describe("a query pair with no value", () => {
  const queryDocument = document(
    [{ name: "p", in: "query", required: true, schema: STRING }],
    "/t",
  );
  const delegated = { cookie: false, header: false, path: false, query: true };

  function queryOf(target: string) {
    return preparse(
      queryDocument,
      { method: "GET", target, headers: [["Host", "harness.invalid"]] },
      delegated,
    ).query;
  }

  it("is not the same as one with an empty value", () => {
    expect(queryOf("/t?p")).toEqual([["p", null]]);
    expect(queryOf("/t?p=")).toEqual([["p", ""]]);
  });

  it("survives into the record of what the harness supplied", () => {
    const parsed = preparse(
      queryDocument,
      { method: "GET", target: "/t?p", headers: [["Host", "harness.invalid"]] },
      delegated,
    );
    expect(describePreparse(parsed).result).toEqual({ query: [["p", null]] });
  });
});

describe("cookie preparse", () => {
  const cookieDocument = document(
    [{ name: "p", in: "cookie", required: true, schema: STRING }],
    "/t",
  );
  const delegated = { cookie: true, header: false, path: false, query: false };

  function cookiesOf(header: string) {
    return preparse(
      cookieDocument,
      { method: "GET", target: "/t", headers: [["Cookie", header]] },
      delegated,
    ).cookies;
  }

  it("keeps a repeated cookie name, in the order it was sent", () => {
    expect(cookiesOf("p=blue; p=black")).toEqual([
      ["p", "blue"],
      ["p", "black"],
    ]);
  });

  it("drops the separator's space and nothing else", () => {
    expect(cookiesOf("p= blue ;q=b l a c k")).toEqual([
      ["p", " blue "],
      ["q", "b l a c k"],
    ]);
  });

  it("splits at the first = and reports a crumb carrying none", () => {
    expect(cookiesOf("p=R=100; q")).toEqual([
      ["p", "R=100"],
      // No `=` at all, which is a different crumb from `q=`.
      ["q", null],
    ]);
    expect(cookiesOf("q=")).toEqual([["q", ""]]);
  });

  it("drops a crumb with nothing in it", () => {
    // What a trailing semicolon leaves. It names no cookie, so reporting it
    // would invent one with an empty name.
    expect(cookiesOf("p=blue; ")).toEqual([["p", "blue"]]);
  });

  it("collects crumbs from every Cookie header the request carries", () => {
    const parsed = preparse(
      cookieDocument,
      {
        method: "GET",
        target: "/t",
        headers: [
          ["Cookie", "p=blue"],
          ["cookie", "p=black"],
        ],
      },
      delegated,
    );

    expect(parsed.cookies).toEqual([
      ["p", "blue"],
      ["p", "black"],
    ]);
    expect(describePreparse(parsed).result).toEqual({
      cookies: [
        ["p", "blue"],
        ["p", "black"],
      ],
    });
  });

  it("supplies nothing where the library splits cookies itself", () => {
    expect(
      preparse(
        cookieDocument,
        { method: "GET", target: "/t", headers: [["Cookie", "p=blue"]] },
        { cookie: false, header: false, path: false, query: false },
      ).cookies,
    ).toBeNull();
  });
});
