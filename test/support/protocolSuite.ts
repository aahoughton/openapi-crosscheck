import { describe, expect, it } from "vitest";
import type { Adapter, AdapterCase } from "../../src/types/adapter";
import { delegatedSplits } from "../../src/types/adapter";
import type { WireRequest } from "../../src/types/wire";
import { preparse } from "../../src/wire/preparse";
import { OAS_VERSIONS } from "../../src/types/openapi";

/**
 * The protocol conformance suite, over whatever speaks the protocol.
 *
 * Written against the protocol rather than against any library, so it runs
 * unchanged over a roster of containers and over the in-process mock. Running
 * it over the mock is what stops the fast tier validating a fiction: a double
 * that drifts from the protocol fails the same suite every container faces.
 *
 * Passing this and the two-sided control in `test/adapters/control.test.ts` is
 * the whole contract for adding a library in another language.
 */

const VANTAGES = ["handedToHandler", "parsedBeforeValidation", "validatedOnly"];
const UNSUPPORTED_REASONS = [
  "cannotRepresentCase",
  "libraryInitUnsupported",
  "adapterLimitation",
  "stageNotOwned",
  "oasVersionNotDeclared",
];

const PROBE: AdapterCase = {
  id: "protocol-conformance",
  document: {
    openapi: "3.1.0",
    info: { title: "protocol", version: "1" },
    paths: {
      "/t/{p}": {
        get: {
          operationId: "protocol",
          parameters: [
            {
              name: "p",
              in: "path",
              required: true,
              style: "simple" as const,
              explode: false,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  },
};

export function protocolSuite(what: string, adapters: readonly Adapter[]): void {
  describe(`${what} answers the protocol`, () => {
    for (const adapter of adapters) {
      it(`${adapter.library} describes itself completely`, () => {
        expect(adapter.library.length).toBeGreaterThan(0);
        // Resolved from the installed package rather than written into the
        // image, which is what lets a matrix be reproduced later. Two leading
        // components rather than three, because a registry that tags releases
        // with two publishes a version this would otherwise refuse, and
        // rewriting it to three would report a release nobody cut. What is
        // being guarded against here is a container that found nothing and
        // said so in prose.
        expect(adapter.libraryVersion).toMatch(/^\d+\.\d+/);
        // Answered rather than omitted, the same rule as every stage below. A
        // container that finds no URL says null, and either way the field is
        // there: `undefined` would mean nobody looked.
        expect(adapter.librarySource === null || typeof adapter.librarySource === "string").toBe(
          true,
        );
        // Whatever is reported has to be openable. The protocol asks each
        // container to normalise its own ecosystem's spelling and to report
        // null rather than a git remote nobody can follow.
        if (adapter.librarySource !== null) {
          expect(adapter.librarySource).toMatch(/^https:\/\/\S+$/);
        }
        // Answered rather than omitted, the same rule the stages below follow.
        // A container with no URL to give says null, and either way the field
        // is there: undefined would mean nobody decided.
        expect(adapter.librarySource === null || typeof adapter.librarySource === "string").toBe(
          true,
        );
        // Whatever is given has to be openable. This is the one thing the
        // protocol checks about it, because where it came from is the
        // container's business and whether it is the right URL is nobody's to
        // check from here.
        if (adapter.librarySource !== null) {
          expect(adapter.librarySource).toMatch(/^https:\/\/\S+$/);
        }
        // Derived by the container from its own manifest, so the harness can
        // only check the shape. What it buys is that a run measuring an
        // unreleased tree cannot be mistaken for one measuring a release.
        expect(["registry", "local"]).toContain(adapter.libraryResolution.kind);
        const { specifier } = adapter.libraryResolution;
        expect(specifier === null || typeof specifier === "string").toBe(true);
        expect(adapter.configuration.id.length).toBeGreaterThan(0);
        expect(adapter.configuration.description.length).toBeGreaterThan(0);
        const { stages } = adapter.capabilities;
        expect(typeof stages.routing).toBe("boolean");
        expect(typeof stages.styleDeserialization).toBe("boolean");
        // Answered rather than omitted. An absent field arrives as undefined,
        // which reads as a disclaim, and a container would then be excused every
        // content case without having said anything at all.
        expect(typeof stages.contentDeserialization).toBe("boolean");
        expect(typeof stages.schemaValidation).toBe("boolean");
        expect(typeof stages.valueExposure).toBe("boolean");
        for (const version of OAS_VERSIONS) {
          // Every version the protocol knows must be answered explicitly, so
          // "does not support" and "nobody answered" stay different facts.
          expect(typeof adapter.capabilities.oasVersions[version]).toBe("boolean");
        }
        expect(Object.keys(adapter.capabilities.oasVersions).sort()).toEqual(
          [...OAS_VERSIONS].sort(),
        );
        // Splitting is per location, and every location must be answered. A gap
        // here would default to owned and silently attribute a harness split.
        for (const location of ["cookie", "header", "path", "query"] as const) {
          expect(typeof stages.splitting[location]).toBe("boolean");
        }
      });

      it(`${adapter.library} answers only within the protocol's closed sets`, async () => {
        const request: WireRequest = {
          method: "GET",
          target: "/t/blue",
          headers: [["Host", "harness.invalid"]],
        };

        const result = await adapter.run(
          PROBE,
          request,
          preparse(PROBE.document, request, delegatedSplits(adapter.capabilities)),
        );

        expect(["accepted", "rejected", "unsupported", "libraryError", "adapterError"]).toContain(
          result.outcome,
        );

        if (result.outcome === "unsupported") {
          expect(UNSUPPORTED_REASONS).toContain(result.reason);
          // Issued by the harness alone. A container claiming it would be
          // asserting something about the runner's own stage guard.
          expect(result.reason).not.toBe("stageNotOwned");
          expect(result.reason).not.toBe("oasVersionNotDeclared");
        }

        if (result.outcome === "accepted" || result.outcome === "rejected") {
          // Answered rather than omitted, the same rule every declaration
          // follows. A missing field would read as "nothing changed" when what
          // it means is that nobody looked, and those are opposite facts about
          // whether the library has a value channel nobody declared.
          expect(["none", "observed", "notCompared"]).toContain(result.inputMutation.kind);
          // The scope, always. A `none` is only as good as what it compared,
          // and a bare kind says nothing about that.
          expect(result.inputMutation.detail.length).toBeGreaterThan(0);
          expect(["observed", "unexposed", "notReached"]).toContain(result.deserialized.kind);
          if (result.deserialized.kind === "observed") {
            // A vantage outside the set fails here rather than being coerced to
            // the nearest member. Extending the set is a deliberate change.
            expect(VANTAGES).toContain(result.deserialized.vantage);
            // Every reported value carries the language's name for its type, and
            // the two are keyed alike so neither can drift from the other.
            expect(Object.keys(result.deserialized.nativeTypes).sort()).toEqual(
              Object.keys(result.deserialized.value).sort(),
            );
            // A parameter cannot be both read and unreadable. The two say
            // opposite things about the same name, and a reader joining the
            // maps would have to pick one; refused here rather than resolved
            // by whichever the renderer happens to consult.
            const observation = result.deserialized;
            const unreadable = Object.keys(observation.unreadable ?? {});
            expect(unreadable.filter((name) => Object.hasOwn(observation.value, name))).toEqual([]);
            // A reason per name, for the same reason `unexposed` carries one: a
            // bare marker says a value is missing without saying what stopped
            // this container reading it, and that is the half a reader needs to
            // tell a container's reach from a library's silence.
            for (const reason of Object.values(observation.unreadable ?? {})) {
              expect(reason.length).toBeGreaterThan(0);
            }
          }
        }
      });
      it(`${adapter.library} answers a query pair that carried no value`, async () => {
        // `?flag` and `?flag=` are different requests, so preparse hands over a
        // null value for the first. A container that reads preparsed query
        // pairs has to do something with that: answer, or say its library's
        // input shape cannot spell it. What it must not do is break on a legal
        // message, which is what reading the null as the text "null" or as an
        // empty value looks like from here.
        const request: WireRequest = {
          method: "GET",
          target: "/t/blue?flag",
          headers: [["Host", "harness.invalid"]],
        };

        const result = await adapter.run(
          PROBE,
          request,
          preparse(PROBE.document, request, delegatedSplits(adapter.capabilities)),
        );

        expect(["accepted", "rejected", "unsupported", "libraryError"]).toContain(result.outcome);
        if (result.outcome === "unsupported") {
          expect(UNSUPPORTED_REASONS).toContain(result.reason);
          expect(result.detail.length).toBeGreaterThan(0);
        }
      });
    }
  });
}
