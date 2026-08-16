import { describe, expect, it } from "vitest";
import { validate } from "@hyperjump/json-schema/openapi-3-1";
import "@hyperjump/json-schema/openapi-3-0";
import "@hyperjump/json-schema/openapi-3-2";
import type { JsonValue } from "../../src/types/json";
import { cases } from "../../src/corpus/index";

/**
 * Every case's document is a valid OpenAPI document, unless the case says it is
 * not and names the rule it breaks.
 *
 * Nothing checked this before. The documents are built by hand, six libraries
 * are handed each one, and a malformed document would have produced six
 * disagreeing answers that read as a finding when they were this repository's
 * bug. Distinguishing "the libraries disagree" from "we wrote nonsense" is the
 * whole point of a corpus, and it was resting on care rather than a gate.
 *
 * Checked against the specification's own meta-schema rather than a
 * hand-written notion of validity, so the gate cannot drift from the document
 * the citations quote.
 *
 * Two-sided on purpose. A case that declares a breakage the meta-schema can see
 * must actually fail it, or the declaration is decoration; a case that declares
 * nothing must validate. A one-sided version would let a wrong declaration sit
 * unnoticed in either direction.
 *
 * Some document rules are prose about a relationship the meta-schema cannot
 * express, and a document breaking one of those validates cleanly. Those
 * declare so, and are then held to validating, so the gate stays two-sided for
 * both kinds rather than exempting the awkward one.
 */

// One meta-schema per OpenAPI version the corpus carries, keyed by the case's
// own oasVersion so a document is validated against the specification it cites.
const META_SCHEMAS = {
  "3.0": "https://spec.openapis.org/oas/3.0/schema",
  "3.1": "https://spec.openapis.org/oas/3.1/schema-base",
  "3.2": "https://spec.openapis.org/oas/3.2/schema-base",
} as const;

describe("every case document is valid OpenAPI, or says why it is not", () => {
  for (const testCase of cases) {
    const declared = testCase.breaksDocumentRule;

    const expectedValid = declared === undefined || !declared.detectedByMetaSchema;

    it(`${testCase.id} ${expectedValid ? "validates" : "breaks the rule it names"}`, async () => {
      // Round-tripped through JSON so the validator sees the document as it
      // crosses the container boundary, rather than as a TypeScript object with
      // a nominal type the validator's own types do not admit.
      const document = JSON.parse(JSON.stringify(testCase.document)) as JsonValue;
      const output = await validate(META_SCHEMAS[testCase.oasVersion], document);

      expect({ id: testCase.id, valid: output.valid }).toEqual({
        id: testCase.id,
        valid: expectedValid,
      });
    });
  }
});

describe("a declared document-rule break carries its citation", () => {
  for (const testCase of cases) {
    const declared = testCase.breaksDocumentRule;
    if (declared === undefined) continue;

    it(`${testCase.id} names the rule and quotes it`, () => {
      // The same standard the conformance tier holds itself to. A case saying a
      // document is invalid without quoting what makes it invalid is an opinion.
      expect(declared.citation.anchor.length).toBeGreaterThan(0);
      expect(declared.citation.quoted.length).toBeGreaterThan(0);
      expect(declared.citation.url).toContain(declared.citation.anchor);
      expect(declared.detail.length).toBeGreaterThan(0);
    });

    it(`${testCase.id} is divergence, because the rule is addressed to the document`, () => {
      // A validator handed a document that breaks a MUST has to do something and
      // the specification does not say what, which is the divergence tier stated
      // in full. A case like this in the conformance tier scores a library for
      // an answer nothing settles: accepting an invalid document would count as
      // failing a rule that says nothing about accepting it.
      //
      // Nothing checked this until four candidate cases were written the other
      // way. The tier is the field the whole two-tier separation rests on, and
      // it was resting on whoever wrote the case remembering.
      expect({ id: testCase.id, tier: testCase.tier }).toEqual({
        id: testCase.id,
        tier: "divergence",
      });
    });
  }
});
