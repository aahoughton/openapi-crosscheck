import { afterAll, describe, expect, it } from "vitest";
import { createAdapters } from "../../src/adapters/registry";
import { adapterDirs } from "../support/adapterDirs";
import { disposeAll, measure } from "../../src/runner/run";
import { delegatedSplits } from "../../src/types/adapter";
import { preparse } from "../../src/wire/preparse";
import { STAGE_SLOTS } from "../../src/report/render";
import { ownsStage } from "../../src/types/pipeline";
import { runCapabilityEvidence, stageReading } from "../../src/capability/evidence";
import type { Case } from "../../src/types/case";
import type { AdapterCapabilities } from "../../src/types/adapter";
import type { OpenApiDocument } from "../../src/types/openapi";
import type { JsonValue } from "../../src/types/json";

/**
 * The two-sided control.
 *
 * An earlier probe of mine reported every library rejecting every input. It was
 * reading a verdict off the wrong property, so it read `undefined`, so it
 * reported "rejected" forever. The table looked plausible and was entirely
 * manufactured by the accessor.
 *
 * A stuck accessor produces exactly one verdict, so requiring both verdicts
 * from trivial inputs catches it. Until an adapter passes this, none of its
 * rows in the matrix mean anything.
 */

function document(schema: JsonValue): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: { title: "control", version: "1" },
    paths: {
      "/t/{p}": {
        get: {
          operationId: "control",
          parameters: [
            { name: "p", in: "path", required: true, style: "simple", explode: false, schema },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };
}

function controlCase(
  id: string,
  schema: JsonValue,
  target: string,
  probeAxis: Case["dimensions"]["probeAxis"] = "canonical",
): Case {
  return {
    id,
    title: id,
    inShort: "control only; not part of the corpus",
    tier: "divergence",
    question: "control only; not part of the corpus",
    basis: null,
    oasVersion: "3.1",
    document: document(schema),
    request: { method: "GET", target, headers: [["Host", "harness.invalid"]] },
    dimensions: {
      declaration: "schema",
      location: "path",
      style: "simple",
      explode: false,
      declaredStyle: "simple",
      declaredExplode: false,
      schema: "scalar",
      probeAxis,
    },
    varies: [],
    holdsConstant: [],
  };
}

const VANTAGES = ["handedToHandler", "parsedBeforeValidation", "validatedOnly"];

// A string parameter accepts "abc". An integer parameter does not.
const MUST_ACCEPT = controlCase("control-accept", { type: "string" }, "/t/abc");
// Labelled by what it varies: an alphabetic value against an integer schema. The
// stage that probes is schema validation, which every library in the roster owns,
// so the runner asks all of them and the preparse assertion below has an answer.
const MUST_REJECT = controlCase("control-reject", { type: "integer" }, "/t/abc", "wrongTypeValue");

/**
 * The control for a write-back value channel: an absent optional query
 * parameter whose schema names a default. A library with no value-returning
 * call can still write the default onto the input it was handed, and that is
 * the one accepted request where such a channel has something to show.
 */
const WRITE_BACK: Case = {
  id: "control-write-back",
  title: "control-write-back",
  inShort: "control only; not part of the corpus",
  tier: "divergence",
  question: "control only; not part of the corpus",
  basis: null,
  oasVersion: "3.1",
  document: {
    openapi: "3.1.0",
    info: { title: "control", version: "1" },
    paths: {
      "/t": {
        get: {
          operationId: "control",
          parameters: [
            {
              name: "p",
              in: "query",
              required: false,
              style: "form",
              explode: false,
              schema: { type: "string", default: "abc" },
            },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  },
  request: { method: "GET", target: "/t", headers: [["Host", "harness.invalid"]] },
  dimensions: {
    declaration: "schema",
    location: "query",
    style: "form",
    explode: false,
    declaredStyle: "form",
    declaredExplode: false,
    schema: "scalar",
    probeAxis: "optionalAbsent",
  },
  varies: [],
  holdsConstant: [],
};

/** What the runner would hand this adapter, so the control drives it the same way. */
function splitFor(adapter: { capabilities: AdapterCapabilities }, testCase: Case) {
  return preparse(testCase.document, testCase.request, delegatedSplits(adapter.capabilities));
}

const adapters = await createAdapters(adapterDirs());
afterAll(async () => {
  await disposeAll(adapters);
});

describe("every adapter produces both verdicts", () => {
  for (const adapter of adapters) {
    it(`${adapter.library} accepts a valid request and rejects an invalid one`, async () => {
      const accepted = await adapter.run(
        MUST_ACCEPT,
        MUST_ACCEPT.request,
        splitFor(adapter, MUST_ACCEPT),
      );
      const rejected = await adapter.run(
        MUST_REJECT,
        MUST_REJECT.request,
        splitFor(adapter, MUST_REJECT),
      );

      expect({ library: adapter.library, outcome: accepted.outcome }).toEqual({
        library: adapter.library,
        outcome: "accepted",
      });
      expect({ library: adapter.library, outcome: rejected.outcome }).toEqual({
        library: adapter.library,
        outcome: "rejected",
      });
    });
  }
});

describe("declared capabilities are demonstrated, not asserted", () => {
  for (const adapter of adapters) {
    it(`${adapter.library} value exposure matches its declaration`, async () => {
      const result = await adapter.run(
        MUST_ACCEPT,
        MUST_ACCEPT.request,
        splitFor(adapter, MUST_ACCEPT),
      );
      if (result.outcome !== "accepted") throw new Error("control did not accept");

      if (adapter.capabilities.stages.valueExposure) {
        // Claimed to expose values, so the claim must be demonstrated on one
        // of the two channels a library can have: values handed back for an
        // accepted request, or values written onto the input where the wire
        // carried none. The write-back control is the one accepted request
        // where the second kind of channel has something to show.
        if (result.deserialized.kind === "observed") {
          expect(Object.keys(result.deserialized.value)).toContain("p");
        } else {
          const written = await adapter.run(
            WRITE_BACK,
            WRITE_BACK.request,
            splitFor(adapter, WRITE_BACK),
          );
          if (written.outcome !== "accepted") throw new Error("write-back control did not accept");
          expect(written.deserialized.kind).toBe("observed");
          if (written.deserialized.kind === "observed") {
            expect(Object.keys(written.deserialized.value)).toContain("p");
          }
        }
      } else {
        expect(result.deserialized.kind).toBe("unexposed");
      }
    });

    it(`${adapter.library} states the vantage of any values it reports`, async () => {
      // A value with no vantage is the ambiguity this field exists to remove:
      // an absent parameter name means "the handler never ran", "the library
      // parsed it anyway" or "it failed its schema" depending on the library,
      // and one column renders all three the same without it.
      const accepted = await adapter.run(
        MUST_ACCEPT,
        MUST_ACCEPT.request,
        splitFor(adapter, MUST_ACCEPT),
      );
      const rejected = await adapter.run(
        MUST_REJECT,
        MUST_REJECT.request,
        splitFor(adapter, MUST_REJECT),
      );
      for (const result of [accepted, rejected]) {
        if (result.outcome !== "accepted" && result.outcome !== "rejected") continue;
        if (result.deserialized.kind !== "observed") continue;
        expect(VANTAGES).toContain(result.deserialized.vantage);
      }
    });

    it(`${adapter.library} declares no stage a probe contradicts`, async () => {
      // The gate fails on refutation and on nothing else.
      //
      // A probe demonstrates ownership and almost never refutes it: a library
      // that performs a deserialization stage differently from the
      // specification and a library that does not perform it produce the same
      // pair of verdicts. Failing a declaration for want of a demonstration
      // would let any library move its attributable failures into
      // `stageNotOwned` by disclaiming, which is the opposite of what this
      // check is for.
      //
      // Two refutations are real, and both are positive findings: a splitting
      // claim where the library answers with the location supplied and not
      // without it, and an exposure claim answered by `unexposed`. See
      // `refutes` for why no third one can be built.
      //
      // A declared stage that no probe showed is published in
      // `capabilities.md` as an unbacked claim, where a reader can weigh it.
      const evidence = await runCapabilityEvidence(adapter);
      const contradicted = STAGE_SLOTS.filter(({ stage, location }) =>
        ownsStage(adapter.capabilities.stages, stage, location ?? "path"),
      )
        .filter(
          ({ stage, location }) => stageReading(evidence, stage, location).refutedBy.length > 0,
        )
        .map(({ stage, location }) => (location === null ? stage : `${stage}:${location}`));

      expect({ library: adapter.library, contradicted }).toEqual({
        library: adapter.library,
        contradicted: [],
      });
    });

    it(`${adapter.library} declares a value channel if it writes one back`, async () => {
      // The third constructible contradiction, and the only one that reaches a
      // channel the published surface does not have. A library writing
      // deserialized values onto the request object its caller passed has given
      // that caller the values without returning them, so an `unexposed`
      // declaration beside it is false.
      //
      // Positive only, like the other two. `none` and `notCompared` are not
      // evidence for a declaration, and a container that cannot compare what it
      // handed over says so rather than claiming nothing happened.
      const accepted = await adapter.run(
        MUST_ACCEPT,
        MUST_ACCEPT.request,
        splitFor(adapter, MUST_ACCEPT),
      );
      const rejected = await adapter.run(
        MUST_REJECT,
        MUST_REJECT.request,
        splitFor(adapter, MUST_REJECT),
      );

      const wroteBack = [accepted, rejected]
        .filter((result) => result.outcome === "accepted" || result.outcome === "rejected")
        .filter((result) => result.inputMutation.kind === "observed")
        .map((result) => result.inputMutation.detail);

      expect({
        library: adapter.library,
        undeclared: adapter.capabilities.stages.valueExposure ? [] : wroteBack,
      }).toEqual({ library: adapter.library, undeclared: [] });
    });

    it(`${adapter.library} preparse is recorded exactly when it is preparsed`, async () => {
      // Asserted through the runner rather than the adapter, because the runner
      // is what computes and stamps the split. An adapter reporting its own
      // preparse would be making a claim about itself with nothing checking it.
      const measurement = await measure([MUST_REJECT], adapter);
      const result = measurement.answers[0]?.result;
      // Recorded exactly when the harness supplied something, and never when it
      // supplied nothing. A library that recovers every location itself must
      // carry no preparse record at all.
      const delegated = delegatedSplits(adapter.capabilities);
      const expected = Object.values(delegated).some(Boolean);
      expect(result?.preparse !== null && result?.preparse !== undefined).toBe(expected);
    });
  }
});
