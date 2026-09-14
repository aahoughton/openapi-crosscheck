import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import type { Dimensions } from "../../src/types/case";
import type { QueryPairInput } from "../../src/types/adapter";
import type { StageOwnership } from "../../src/types/pipeline";
import {
  canBeAsked as canBeAskedAtBoundary,
  probedStage,
  withheldOverQueryDecoding,
} from "../../src/types/pipeline";

/**
 * The stage rule, checked without a container.
 *
 * `probedStage` is a rule rather than a per-case label so that it can be stated
 * and argued with. That only holds while the rule is checked against the whole
 * corpus: a rule nobody exercises over every case is a per-case judgement with
 * extra steps.
 */

const ALL: StageOwnership = {
  routing: true,
  splitting: { cookie: true, header: true, path: true, query: true },
  styleDeserialization: true,
  contentDeserialization: true,
  schemaValidation: true,
  valueExposure: true,
};

function owning(overrides: Partial<StageOwnership>): StageOwnership {
  return { ...ALL, ...overrides };
}

function canBeAsked(
  ownership: StageOwnership,
  dimensions: Dimensions,
  target: string,
  queryPairInput: QueryPairInput = "notUsed",
): boolean {
  return canBeAskedAtBoundary(ownership, dimensions, target, queryPairInput);
}

/**
 * A target whose query carries nothing query decoding converts, for the tests
 * here that are about the declaration rather than the wire.
 */
const PLAIN = "/t?p=blue";

const styleDimensions: Dimensions = {
  declaration: "schema",
  location: "query",
  style: "form",
  explode: true,
  declaredStyle: "form",
  declaredExplode: true,
  schema: "scalar",
  probeAxis: "canonical",
};

const contentDimensions: Dimensions = {
  declaration: "content",
  location: "query",
  mediaType: "application/json",
  schema: "object",
  probeAxis: "canonical",
};

describe("the two deserialization stages are siblings", () => {
  it("routes a case to the mechanism its own declaration names", () => {
    expect(probedStage(styleDimensions)).toBe("styleDeserialization");
    expect(probedStage(contentDimensions)).toBe("contentDeserialization");
  });

  it("does not let ownership of one stand in for the other", () => {
    // The failure this split exists to prevent. One boolean covering both made
    // a library that applies styles answer questions about media types it never
    // parses, and left it nowhere to say so.
    expect(canBeAsked(owning({ contentDeserialization: false }), contentDimensions, PLAIN)).toBe(
      false,
    );
    expect(canBeAsked(owning({ contentDeserialization: false }), styleDimensions, PLAIN)).toBe(
      true,
    );
    expect(canBeAsked(owning({ styleDeserialization: false }), styleDimensions, PLAIN)).toBe(false);
    expect(canBeAsked(owning({ styleDeserialization: false }), contentDimensions, PLAIN)).toBe(
      true,
    );
  });

  it("still requires every stage downstream of the probe", () => {
    // A verdict on a content case needs the schema validation that follows it,
    // the same as a style case does. Siblings at one position, not a shortcut
    // past the rest of the pipeline.
    expect(canBeAsked(owning({ schemaValidation: false }), contentDimensions, PLAIN)).toBe(false);
  });

  it("does not require value exposure for a verdict", () => {
    expect(canBeAsked(owning({ valueExposure: false }), contentDimensions, PLAIN)).toBe(true);
  });

  it("requires content parsing even for a content case probing the schema", () => {
    // A wrong-typed value inside a `content` parameter probes the schema, and
    // the schema is written against the parsed representation. The harness
    // splits and never parses, so a library owning schema validation alone is
    // handed eleven characters of text where the case asks about an object.
    const wrongTypeInContent: Dimensions = {
      ...contentDimensions,
      probeAxis: "wrongTypeValue",
    };
    expect(probedStage(wrongTypeInContent)).toBe("schemaValidation");
    expect(canBeAsked(owning({ contentDeserialization: false }), wrongTypeInContent, PLAIN)).toBe(
      false,
    );
    // The same axis on a scalar `schema` parameter stays askable: there the raw
    // text the harness supplies is the value the schema sees.
    expect(
      canBeAsked(
        owning({ styleDeserialization: false }),
        { ...styleDimensions, probeAxis: "wrongTypeValue" },
        PLAIN,
      ),
    ).toBe(true);
  });

  it("requires style deserialization for a structured case probing the value", () => {
    // `R=blue&G=200` is two query pairs, and the object the schema validates is
    // assembled out of them. A library handed the pairs and assembling nothing
    // rejects because `p` is absent, which scores as a pass on a case expecting
    // a rejection, without the varied property ever reaching a schema.
    const wrongTypeInObject: Dimensions = {
      ...styleDimensions,
      schema: "object",
      probeAxis: "wrongTypeValue",
    };
    expect(probedStage(wrongTypeInObject)).toBe("schemaValidation");
    expect(canBeAsked(owning({ styleDeserialization: false }), wrongTypeInObject, PLAIN)).toBe(
      false,
    );

    // Absence in the same shape stays askable. Nothing needs assembling for a
    // library to notice that nothing arrived, so the verdict is about what the
    // case asks.
    expect(
      canBeAsked(
        owning({ styleDeserialization: false }),
        { ...styleDimensions, schema: "object", probeAxis: "missingName" },
        PLAIN,
      ),
    ).toBe(true);
  });
});

describe("a style that carries the name is not askable without the style stage", () => {
  const matrixScalar: Dimensions = {
    declaration: "schema",
    location: "path",
    style: "matrix",
    explode: false,
    declaredStyle: "matrix",
    declaredExplode: false,
    schema: "scalar",
    probeAxis: "wrongTypeValue",
  };

  it("requires it for a scalar probing the schema", () => {
    // The trap the shape-based rule alone left open. `;p=42` is what preparse
    // hands over, a library reading only the schema refuses those characters as
    // a non-integer, and the cell would credit it with catching a wrong-typed
    // value it never saw.
    expect(probedStage(matrixScalar)).toBe("schemaValidation");
    expect(canBeAsked(owning({ styleDeserialization: false }), matrixScalar, PLAIN)).toBe(false);
    expect(
      canBeAsked(
        owning({ styleDeserialization: false }),
        { ...matrixScalar, style: "label" },
        PLAIN,
      ),
    ).toBe(false);
  });

  it("requires it whatever the case probes", () => {
    for (const probeAxis of ["missingName", "optionalAbsent"] as const) {
      expect(
        canBeAsked(owning({ styleDeserialization: false }), { ...matrixScalar, probeAxis }, PLAIN),
      ).toBe(false);
    }
  });

  it("leaves the styles that do not carry the name alone", () => {
    // `simple` writes the segment as the value, so the raw text is the value and
    // a schema-only library is answering the question the case asks.
    expect(
      canBeAsked(
        owning({ styleDeserialization: false }),
        { ...matrixScalar, style: "simple", declaredStyle: "simple" },
        PLAIN,
      ),
    ).toBe(true);
  });
});

describe("an encoding variant is read after the raw value is split", () => {
  const encoded: Dimensions = {
    ...styleDimensions,
    probeAxis: "encodingVariant",
  };

  it("probes the parameter's deserializer and requires it", () => {
    expect(probedStage(encoded)).toBe("styleDeserialization");
    expect(canBeAsked(owning({ styleDeserialization: false }), encoded, PLAIN)).toBe(false);
  });
});

describe("a wire that query decoding converts needs a compatible pair input", () => {
  const disclaimsQuery = owning({
    splitting: { cookie: true, header: true, path: true, query: false },
  });

  it("withholds percent triples and plus from a library expecting decoded pairs", () => {
    // The harness hands query values through raw and cannot decode, because
    // whether `+` is a space is a question the corpus asks. A library that
    // leaves query splitting to its caller is handed decoded pairs wherever
    // it is deployed, so the raw text is an input its contract never meets,
    // and a cell grading it on that input would measure the hand-off.
    for (const target of ["/t?p=a%2Bb", "/t?p=a+b", "/t?p=blue%7Cblack"]) {
      expect(canBeAsked(disclaimsQuery, styleDimensions, target, "decoded")).toBe(false);
      expect(withheldOverQueryDecoding(disclaimsQuery, styleDimensions, target, "decoded")).toBe(
        true,
      );
    }
  });

  it("keeps asking when the public input accepts raw pairs", () => {
    expect(canBeAsked(disclaimsQuery, styleDimensions, "/t?p=a%2Bb", "raw")).toBe(true);
  });

  it("keeps asking when the wire carries nothing decoding converts", () => {
    expect(canBeAsked(disclaimsQuery, styleDimensions, "/t?p=blue", "decoded")).toBe(true);
  });

  it("keeps asking a library that splits queries for itself", () => {
    expect(canBeAsked(ALL, styleDimensions, "/t?p=a%2Bb")).toBe(true);
  });

  it("reads the query, and only the query", () => {
    // Encoding in the path is style deserialization's to interpret, and a
    // percent sign the grammar of a triple does not match converts to nothing.
    expect(canBeAsked(disclaimsQuery, styleDimensions, "/a+b%20c?p=blue", "decoded")).toBe(true);
    expect(canBeAsked(disclaimsQuery, styleDimensions, "/t?p=100%", "decoded")).toBe(true);
  });

  it("names the guard only when it is the deciding reason", () => {
    // A library that also lacks the deserializer is withheld either way, and
    // its cells keep the chain-ownership detail they have always carried.
    const lacksBoth = owning({
      splitting: { cookie: true, header: true, path: true, query: false },
      styleDeserialization: false,
    });
    expect(canBeAsked(lacksBoth, styleDimensions, "/t?p=a+b", "decoded")).toBe(false);
    expect(withheldOverQueryDecoding(lacksBoth, styleDimensions, "/t?p=a+b", "decoded")).toBe(
      false,
    );
  });

  it("leaves cookie pairs alone: 3.2 cookie decoding is the identity", () => {
    // A raw cookie pair is exactly what a caller would hand over, so the one
    // cookie case carrying a percent triple stays a real measurement even for
    // a library that leaves cookie splitting to its caller.
    const cookiePercentTriple: Dimensions = {
      declaration: "schema",
      location: "cookie",
      style: "cookie",
      explode: true,
      declaredStyle: "cookie",
      declaredExplode: "unset",
      schema: "scalar",
      probeAxis: "encodingVariant",
    };
    const disclaimsCookie = owning({
      splitting: { cookie: false, header: true, path: true, query: true },
    });
    expect(canBeAsked(disclaimsCookie, cookiePercentTriple, "/t")).toBe(true);
  });
});

describe("a reserved declaration is decided at the validation boundary", () => {
  const reserved: Dimensions = {
    ...styleDimensions,
    location: "header",
    probeAxis: "reservedName",
  };

  it("is askable after the harness supplies a split header", () => {
    expect(probedStage(reserved)).toBe("schemaValidation");
    expect(
      canBeAsked(
        owning({
          splitting: { cookie: true, header: false, path: true, query: true },
          styleDeserialization: false,
        }),
        reserved,
        PLAIN,
      ),
    ).toBe(true);
  });

  it("still requires the library to own validation", () => {
    expect(canBeAsked(owning({ schemaValidation: false }), reserved, PLAIN)).toBe(false);
  });
});

describe("the rule applied to the whole corpus", () => {
  it("never sends a content parameter through style deserialization", () => {
    const misrouted = cases
      .filter((testCase) => testCase.dimensions.declaration === "content")
      .filter((testCase) => probedStage(testCase.dimensions) === "styleDeserialization")
      .map((testCase) => testCase.id);
    expect(misrouted).toEqual([]);
  });

  it("never sends a schema parameter through content deserialization", () => {
    const misrouted = cases
      .filter((testCase) => testCase.dimensions.declaration === "schema")
      .filter((testCase) => probedStage(testCase.dimensions) === "contentDeserialization")
      .map((testCase) => testCase.id);
    expect(misrouted).toEqual([]);
  });

  it("keeps a malformed representation upstream of the schema", () => {
    // A value the declared serialization cannot read never reaches the schema,
    // so asking a schema-only library about it attributes an upstream stage to
    // it. The axis is what carries this: `foreignWireShape` is bytes that do
    // not conform, `wrongTypeValue` is a value that deserialized and is
    // well-formed for some other type.
    const malformed = cases.filter(
      (testCase) =>
        testCase.dimensions.declaration === "content" &&
        testCase.dimensions.probeAxis === "foreignWireShape",
    );
    expect(malformed.length).toBeGreaterThan(0);
    for (const testCase of malformed) {
      expect({ id: testCase.id, stage: probedStage(testCase.dimensions) }).toEqual({
        id: testCase.id,
        stage: "contentDeserialization",
      });
    }
  });
});
