import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import type { JsonValue } from "../../src/types/json";

/**
 * The constants the coverage pages publish under "Held constant across every
 * case", checked over the corpus.
 *
 * Those bullets are prose, so nothing else notices when a new case varies one
 * of them. Each check here names the cases breaking a stated constant; a
 * failure means either the case is wrong or the published text has to change.
 */

const nonHost = cases.flatMap((testCase) =>
  testCase.request.headers
    .filter(([name]) => name.toLowerCase() !== "host")
    .map(([name, value]) => ({
      id: testCase.id,
      location: testCase.dimensions.location,
      name,
      value,
    })),
);

const wireTexts = cases.flatMap((testCase) => [
  { id: testCase.id, text: testCase.request.target },
  ...testCase.request.headers.map(([, value]) => ({ id: testCase.id, text: value })),
]);

const declarations = cases.flatMap((testCase) =>
  Object.values(testCase.document.paths).flatMap((pathItem) =>
    [pathItem.get, pathItem.post].flatMap((operation) =>
      (operation?.parameters ?? []).map((parameter) => ({ id: testCase.id, parameter })),
    ),
  ),
);

function objects(value: JsonValue): Record<string, JsonValue>[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(objects);
  return [value, ...Object.values(value).flatMap(objects)];
}

describe("the published held constants hold", () => {
  it("sends printable ASCII with well-formed, uppercase, ASCII-only percent triples", () => {
    expect(wireTexts.filter(({ text }) => /[^\x20-\x7e]/.test(text)).map(({ id }) => id)).toEqual(
      [],
    );
    const triples = wireTexts.flatMap(({ id, text }) =>
      [...text.matchAll(/%(.{0,2})/g)].map((match) => ({ id, hex: match[1] ?? "" })),
    );
    expect(triples.filter(({ hex }) => !/^[0-9A-F]{2}$/.test(hex)).map(({ id }) => id)).toEqual([]);
    expect(triples.filter(({ hex }) => parseInt(hex, 16) > 0x7f).map(({ id }) => id)).toEqual([]);
  });

  it("declares only plain-letter parameter names, and never sends a raw bracket", () => {
    expect(
      declarations
        .filter(({ parameter }) => !/^[A-Za-z]+$/.test(parameter.name))
        .map(({ id }) => id),
    ).toEqual([]);
    expect(cases.filter((c) => /[[\]]/.test(c.request.target)).map((c) => c.id)).toEqual([]);
  });

  it("expects a one-member array only under a percent-encoded comma", () => {
    const oneMember = cases.filter(
      (c) =>
        c.tier === "conformance" &&
        c.expectedValues !== null &&
        Object.values(c.expectedValues).some((value) => Array.isArray(value) && value.length < 2),
    );
    for (const testCase of oneMember) {
      expect({ id: testCase.id, encodedComma: testCase.request.target.includes("%2C") }).toEqual({
        id: testCase.id,
        encodedComma: true,
      });
    }
  });

  it("expects flat objects with exactly R then G", () => {
    const shapes = cases.flatMap((c) =>
      c.tier === "conformance" && c.expectedValues !== null
        ? Object.values(c.expectedValues).flatMap((value) =>
            objects(value).map((object) => ({ id: c.id, object })),
          )
        : [],
    );
    expect(
      shapes
        .filter(
          ({ object }) =>
            Object.keys(object).join(",") !== "R,G" ||
            Object.values(object).some((value) => value !== null && typeof value === "object"),
        )
        .map(({ id }) => id),
    ).toEqual([]);
    const schemaProperties = declarations.flatMap(({ id, parameter }) => {
      const schemas = [
        parameter.schema,
        ...Object.values(parameter.content ?? {}).map((media) => media.schema),
      ];
      return schemas.flatMap((schema) =>
        schema === undefined
          ? []
          : objects(schema)
              .filter((node) => node["properties"] !== undefined)
              .map((node) => ({ id, keys: Object.keys(node["properties"] as object).join(",") })),
      );
    });
    expect(schemaProperties.filter(({ keys }) => keys !== "R,G").map(({ id }) => id)).toEqual([]);
  });

  it("sends header parameter values with no whitespace after a comma and no percent triple", () => {
    const headerValues = nonHost.filter(({ location }) => location === "header");
    expect(headerValues.length).toBeGreaterThan(0);
    expect(
      headerValues
        .filter(({ value }) => /,\s/.test(value) || value.includes("%"))
        .map(({ id }) => id),
    ).toEqual([]);
    expect(
      cases.filter((c) => c.oasVersion === "3.2" && c.dimensions.location === "header"),
    ).toEqual([]);
  });

  it("sends one Cookie line carrying only the probed parameter, in unvaried casing", () => {
    for (const testCase of cases) {
      const lines = testCase.request.headers.filter(([name]) => name.toLowerCase() === "cookie");
      if (lines.length === 0) continue;
      const declared = declarations
        .filter(({ id, parameter }) => id === testCase.id && parameter.in === "cookie")
        .map(({ parameter }) => parameter.name);
      const names = (lines[0]?.[1] ?? "").split("; ").map((pair) => pair.split("=")[0]);
      // An exploded object sends its properties as the cookie names.
      const allowed = new Set([...declared, "R", "G"]);
      expect({
        id: testCase.id,
        lines: lines.length,
        headerName: lines[0]?.[0],
        foreign: names.filter((name) => name === undefined || !allowed.has(name)),
      }).toEqual({ id: testCase.id, lines: 1, headerName: "Cookie", foreign: [] });
    }
  });

  it("sends no empty path segment, trailing slash or encoded slash in a path", () => {
    const paths = cases.map((c) => ({ id: c.id, path: c.request.target.split("?")[0] ?? "" }));
    expect(paths.filter(({ path }) => /\/\/|\/$|%2F/i.test(path)).map(({ id }) => id)).toEqual([]);
  });

  it("sends spaceDelimited members with %20 and never +", () => {
    const spaced = cases.filter(
      (c) => c.dimensions.declaration === "schema" && c.dimensions.style === "spaceDelimited",
    );
    expect(spaced.length).toBeGreaterThan(0);
    expect(spaced.filter((c) => c.request.target.includes("+")).map((c) => c.id)).toEqual([]);
  });
});
