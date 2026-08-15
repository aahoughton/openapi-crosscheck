import { afterAll } from "vitest";
import { createAdapters } from "../../src/adapters/registry";
import { disposeAll } from "../../src/runner/run";
import { adapterDirs } from "../support/adapterDirs";
import { protocolSuite } from "../support/protocolSuite";

/**
 * Every container in `adapters/` against the protocol suite.
 *
 * The suite itself lives in `test/support/protocolSuite.ts` and runs in the
 * fast tier too, against the in-process mock. Same assertions, so the double
 * the harness tests rely on is held to the contract the containers are held to.
 */

const adapters = await createAdapters(adapterDirs());
afterAll(async () => {
  await disposeAll(adapters);
});

protocolSuite("every container", adapters);
