import { describe, expect, it } from "vitest";
import { validate } from "@hyperjump/json-schema/openapi-3-1";
import "@hyperjump/json-schema/openapi-3-0";
import "@hyperjump/json-schema/openapi-3-2";
import { cases } from "../../src/corpus/index";
import { querystringCases32, querystringUnder31 } from "../../src/corpus/cases/oas32/querystring";
import type { JsonValue } from "../../src/types/json";
import {
  CONTENT_MEDIA_TYPES,
  contentCellKey,
  definedContentSurface,
} from "../../src/surface/surface";
import { canBeAsked, probedStage } from "../../src/types/pipeline";
import type { StageOwnership } from "../../src/types/pipeline";

/**
 * The querystring cases, held to what the location makes true of them.
 *
 * They are in the corpus and every measured library has answered them. What is
 * here is what the constitution tests do not cover on their own: that the
 * location is 3.2-only and placed on the 3.2 surface alone, that the two media
 * types are paired on one location so a rejection names its cause, that the
 * document-rule cases are divergence, and that the set holds a case a library
 * can only pass by reading the parameter.
 *
 * They were written outside the corpus first, while no container spoke protocol
 * 3 and no answer existed for them, and promoted once the containers did. The
 * first test here is what holds the file and the corpus to each other.
 */

const META_SCHEMAS = {
  "3.0": "https://spec.openapis.org/oas/3.0/schema",
  "3.1": "https://spec.openapis.org/oas/3.1/schema-base",
  "3.2": "https://spec.openapis.org/oas/3.2/schema-base",
} as const;

/** A library owning every stage, for asking whether a case is askable at all. */
const OWNS_EVERYTHING: StageOwnership = {
  routing: true,
  splitting: { cookie: true, header: true, path: true, query: true },
  styleDeserialization: true,
  contentDeserialization: true,
  schemaValidation: true,
  valueExposure: true,
};

describe("the querystring cases", () => {
  it("are the querystring cases the corpus carries, all of them", () => {
    // Held from both directions. Every case in this file is in the corpus, and
    // every querystring case in the corpus is in this file, so neither one can
    // grow a case the other does not know about.
    const published = cases.filter((c) => c.dimensions.location === "querystring");
    expect(published.map((c) => c.id).sort()).toEqual(querystringCases32.map((c) => c.id).sort());
  });

  it("declare the location and the version that defines it", () => {
    for (const testCase of querystringCases32) {
      expect({ id: testCase.id, location: testCase.dimensions.location }).toEqual({
        id: testCase.id,
        location: "querystring",
      });
      expect(testCase.oasVersion).toBe("3.2");
      // The specification requires this location to be declared with `content`,
      // so a candidate declaring a style would be one the meta-schema rejects
      // for a reason the case did not intend.
      expect(testCase.dimensions.declaration).toBe("content");
    }
  });

  describe("validate against the 3.2 meta-schema, or say why not", () => {
    for (const testCase of querystringCases32) {
      const declared = testCase.breaksDocumentRule;
      const expectedValid = declared === undefined || !declared.detectedByMetaSchema;

      it(`${testCase.id} ${expectedValid ? "validates" : "breaks the rule it names"}`, async () => {
        const document = JSON.parse(JSON.stringify(testCase.document)) as JsonValue;
        const output = await validate(META_SCHEMAS[testCase.oasVersion], document);
        expect({ id: testCase.id, valid: output.valid }).toEqual({
          id: testCase.id,
          valid: expectedValid,
        });
      });
    }
  });

  it("quote the rule where they claim a document breaks one", () => {
    for (const testCase of querystringCases32) {
      const declared = testCase.breaksDocumentRule;
      if (declared === undefined) continue;
      expect(declared.citation.anchor.length).toBeGreaterThan(0);
      expect(declared.citation.quoted.length).toBeGreaterThan(0);
      expect(declared.citation.url).toContain(declared.citation.anchor);
      expect(declared.detail.length).toBeGreaterThan(0);
      expect(declared.citation.oasVersion).toBe(testCase.oasVersion);
    }
  });

  it("are divergence where they break a document rule, so nothing is attributed", () => {
    // The same rule test/constitution/document.test.ts holds the exported
    // corpus to, applied here so these cannot arrive in it already wrong. A
    // validator handed a document that breaks a MUST addressed to its author
    // has to do something and the specification does not say what, so a
    // conformance tier here would score a library for an answer nothing
    // settles. These four were written as conformance first, which is why both
    // sides now check it.
    for (const testCase of querystringCases32) {
      if (testCase.breaksDocumentRule === undefined) continue;
      expect({ id: testCase.id, tier: testCase.tier }).toEqual({
        id: testCase.id,
        tier: "divergence",
      });
    }
  });

  it("quote the specification as rendered, with no markup of ours added", () => {
    // The quotes went in with backticks around `content` and `in: "querystring"`,
    // which the published document does not have: it renders those as plain
    // text, and every other citation in this repository is transcribed that way.
    // A quote carrying markup is a quote someone retyped, and the point of the
    // field is that nobody has to trust that it was retyped faithfully.
    const quotes = querystringCases32.flatMap((c) => [
      ...(c.tier === "conformance" ? c.citations.map((citation) => citation.quoted) : []),
      ...(c.breaksDocumentRule === undefined ? [] : [c.breaksDocumentRule.citation.quoted]),
    ]);
    expect(quotes.filter((quoted) => quoted.includes("`"))).toEqual([]);
  });

  it("carry a populated citation per conformance case", () => {
    for (const testCase of querystringCases32) {
      if (testCase.tier !== "conformance") continue;
      expect(testCase.citations.length).toBeGreaterThan(0);
      for (const citation of testCase.citations) {
        expect(citation.anchor.length).toBeGreaterThan(0);
        expect(citation.quoted.length).toBeGreaterThan(0);
        expect(citation.url).toContain(citation.anchor);
        expect(citation.oasVersion).toBe(testCase.oasVersion);
      }
    }
  });

  it("place under 3.2 and never under 3.1, for the media type the surface enumerates", () => {
    // The surface admits querystring under 3.2 alone, and this asserts both
    // halves: placed under 3.2, unplaceable under 3.1.
    const under32 = new Set(definedContentSurface("3.2").map(contentCellKey));
    const under31 = new Set(definedContentSurface("3.1").map(contentCellKey));
    for (const testCase of querystringCases32) {
      if (testCase.breaksDocumentRule !== undefined) continue;
      if (testCase.dimensions.declaration !== "content") continue;
      if (!CONTENT_MEDIA_TYPES.includes(testCase.dimensions.mediaType)) continue;
      const key = contentCellKey({
        location: testCase.dimensions.location,
        mediaType: testCase.dimensions.mediaType,
        schema: testCase.dimensions.schema,
        condition: "wellFormed",
      });
      expect({ id: testCase.id, on32: under32.has(key), on31: under31.has(key) }).toEqual({
        id: testCase.id,
        on32: true,
        on31: false,
      });
    }
  });

  it("send every media type the surface enumerates, and no other", () => {
    // The axis holds the media types the corpus sends. These cases are what put
    // `application/x-www-form-urlencoded` on it: they were promoted first and
    // the member added second, so the denominator never counted cells for a
    // representation nothing had sent. This fails if one moves without the
    // other in either direction.
    const sent = new Set(
      querystringCases32.flatMap((c) =>
        c.dimensions.declaration === "content" ? [c.dimensions.mediaType] : [],
      ),
    );
    expect([...sent].sort()).toEqual(["application/json", "application/x-www-form-urlencoded"]);
    for (const mediaType of sent) expect(CONTENT_MEDIA_TYPES).toContain(mediaType);
  });

  it("are askable of a library that owns every stage, without a splitting claim", () => {
    // The chain for a querystring parameter has no splitting step, so a case
    // here must be askable whether or not a library claims to split anything.
    const ownsNoSplit: StageOwnership = {
      ...OWNS_EVERYTHING,
      splitting: { cookie: false, header: false, path: false, query: false },
    };
    for (const testCase of querystringCases32) {
      expect({ id: testCase.id, asked: canBeAsked(ownsNoSplit, testCase.dimensions) }).toEqual({
        id: testCase.id,
        asked: true,
      });
    }
  });

  it("probe a stage a library can be held to", () => {
    // Never `splitting`: there is no split between the request and the value,
    // and `ownsStage` throws rather than answering for one.
    for (const testCase of querystringCases32) {
      expect(probedStage(testCase.dimensions)).not.toBe("splitting");
    }
  });

  it("include one whose expected verdict is reachable only by reading the parameter", () => {
    // The silence detector, and the reason the set is worth measuring at all. A
    // library that accepts the document and never looks at the parameter
    // accepts everything else here and is indistinguishable from one that
    // validated correctly.
    const rejecting = querystringCases32.filter(
      (c) =>
        c.tier === "conformance" && c.expected === "rejected" && c.breaksDocumentRule === undefined,
    );
    expect(rejecting.map((c) => c.id)).toEqual([
      "querystring-form-urlencoded-object-wrong-type-oas32",
    ]);
  });

  it("pair the two media types on one location, so a rejection names its cause", () => {
    const canonical = querystringCases32.flatMap((c) =>
      c.dimensions.declaration === "content" && c.dimensions.probeAxis === "canonical"
        ? [c.dimensions.mediaType]
        : [],
    );
    expect([...canonical].sort()).toEqual([
      "application/json",
      "application/x-www-form-urlencoded",
    ]);
  });

  it("send a request the target can carry both readings of", async () => {
    // 3d(a): the case declaring a querystring parameter beside an `in: query`
    // one needs both the query pairs and the whole query string, and the target
    // carries both at once. If this ever needed a protocol field, this is the
    // case that would say so.
    const both = querystringCases32.find((c) => c.id === "querystring-beside-query-oas32");
    expect(both?.request.target).toBe("/t?R=100&G=200");
  });

  it("show why there is no 3.1 mirror: the older meta-schema refuses the location", async () => {
    const document = JSON.parse(JSON.stringify(querystringUnder31)) as JsonValue;
    const output = await validate(META_SCHEMAS["3.1"], document);
    expect(output.valid).toBe(false);
  });
});
