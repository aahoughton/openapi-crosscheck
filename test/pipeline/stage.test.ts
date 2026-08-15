import { describe, expect, it } from "vitest";
import { cases } from "../../src/corpus/index";
import type { Dimensions } from "../../src/types/case";
import type { StageOwnership } from "../../src/types/pipeline";
import { canBeAsked, probedStage } from "../../src/types/pipeline";

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
    expect(canBeAsked(owning({ contentDeserialization: false }), contentDimensions)).toBe(false);
    expect(canBeAsked(owning({ contentDeserialization: false }), styleDimensions)).toBe(true);
    expect(canBeAsked(owning({ styleDeserialization: false }), styleDimensions)).toBe(false);
    expect(canBeAsked(owning({ styleDeserialization: false }), contentDimensions)).toBe(true);
  });

  it("still requires every stage downstream of the probe", () => {
    // A verdict on a content case needs the schema validation that follows it,
    // the same as a style case does. Siblings at one position, not a shortcut
    // past the rest of the pipeline.
    expect(canBeAsked(owning({ schemaValidation: false }), contentDimensions)).toBe(false);
  });

  it("does not require value exposure for a verdict", () => {
    expect(canBeAsked(owning({ valueExposure: false }), contentDimensions)).toBe(true);
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
    expect(canBeAsked(owning({ contentDeserialization: false }), wrongTypeInContent)).toBe(false);
    // The same axis on a scalar `schema` parameter stays askable: there the raw
    // text the harness supplies is the value the schema sees.
    expect(
      canBeAsked(owning({ styleDeserialization: false }), {
        ...styleDimensions,
        probeAxis: "wrongTypeValue",
      }),
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
    expect(canBeAsked(owning({ styleDeserialization: false }), wrongTypeInObject)).toBe(false);

    // Absence in the same shape stays askable. Nothing needs assembling for a
    // library to notice that nothing arrived, so the verdict is about what the
    // case asks.
    expect(
      canBeAsked(owning({ styleDeserialization: false }), {
        ...styleDimensions,
        schema: "object",
        probeAxis: "missingName",
      }),
    ).toBe(true);
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
