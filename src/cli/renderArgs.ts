import type { Case } from "../types/case";
import { presentVersions } from "../report/view";

/**
 * The arguments the two render commands share: one run directory, and an
 * optional `--oas <version>` filter, repeatable.
 *
 * `--oas 3.1` renders the reading of one specification version out of a run
 * that may hold several. Filtering happens at render time and never at measure
 * time, so the run directory always holds every answer and a filtered page is
 * a reading of it rather than a different measurement.
 */
export function parseRenderArgs(
  argv: readonly string[],
  command: string,
): { path: string; versions: readonly string[] } {
  let path: string | undefined;
  const versions: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--oas") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`--oas needs a version\n  pnpm ${command} report --oas 3.1`);
      }
      versions.push(value);
      index += 1;
    } else if (argument !== undefined && argument.startsWith("--")) {
      throw new Error(`${command} does not understand ${argument}`);
    } else if (path === undefined) {
      path = argument;
    } else {
      throw new Error(`${command} takes one run directory and ${argument} is a second`);
    }
  }
  if (path === undefined) {
    throw new Error(`${command} needs one run directory\n  pnpm ${command} report`);
  }
  return { path, versions };
}

/**
 * The cases the requested versions name, or every case when none was
 * requested. A version the run does not hold is an error rather than an empty
 * rendering, because a blank page silently agreeing with a typo is the failure
 * mode this flag would otherwise ship.
 */
export function selectVersions(
  cases: readonly Case[],
  versions: readonly string[],
): readonly Case[] {
  if (versions.length === 0) return cases;
  const present = presentVersions(cases);
  for (const version of versions) {
    if (!(present as readonly string[]).includes(version)) {
      throw new Error(`this run holds no OpenAPI ${version} cases; it holds ${present.join(", ")}`);
    }
  }
  return cases.filter((c) => (versions as readonly string[]).includes(c.oasVersion));
}
