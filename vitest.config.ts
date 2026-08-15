import { defineConfig } from "vitest/config";

/**
 * Two tiers, split by what a test needs to run.
 *
 * `harness` needs nothing but this checkout. It covers the runner, the scorer,
 * the surface, the wire encoding, the protocol client and every rendered byte
 * of the committed report, by reading measurements off disk and by pointing the
 * protocol client at a server running in this process.
 *
 * `containers` needs a Docker daemon and builds an image per library. It is the
 * adapter contract: the protocol suite, the two-sided control, and the check
 * that a fresh run still produces the committed measurements.
 *
 * Listed by file rather than matched by directory. The list is the statement of
 * which tests cost minutes, so a test that quietly starts needing Docker should
 * have to be added here by hand rather than be absorbed by a pattern.
 */
const CONTAINER_TESTS = [
  "test/adapters/control.test.ts",
  "test/adapters/freshRun.test.ts",
  "test/container/protocol.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "harness",
          include: ["test/**/*.test.ts"],
          exclude: CONTAINER_TESTS,
        },
      },
      {
        test: {
          name: "containers",
          include: CONTAINER_TESTS,
          // One daemon, one image cache, and containers that bind host ports.
          // Files that each bring up the whole roster are cheaper in sequence
          // than competing for the same daemon.
          fileParallelism: false,
          testTimeout: 600_000,
          hookTimeout: 600_000,
        },
      },
    ],
  },
});
