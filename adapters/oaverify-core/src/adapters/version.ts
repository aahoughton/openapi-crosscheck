import { createRequire } from "node:module";
import type { LibraryResolution } from "../types/adapter";

const require = createRequire(import.meta.url);

/**
 * Read a library's resolved version from its installed package.json.
 *
 * Read at runtime rather than written down, because `latest` and reproducibility
 * are in tension and the recorded resolution is what lets a matrix be
 * reproduced later.
 */
export function readVersion(packageName: string): string {
  const manifest = require(`${packageName}/package.json`) as { version?: string };
  const version = manifest.version;
  if (typeof version !== "string") throw new Error(`no version for ${packageName}`);
  return version;
}

/**
 * How this container was told to install the library, read from its own
 * manifest.
 *
 * Everything npm can install from outside the registry counts as local: the
 * `file:`, `link:`, `portal:` and `workspace:` protocols, a bare path, a git or
 * GitHub specifier, and a tarball URL. What remains is a registry range,
 * including `latest` and an `npm:` alias.
 */
export function readResolution(packageName: string): LibraryResolution {
  const manifest = require("/app/package.json") as { dependencies?: Record<string, string> };
  const specifier = manifest.dependencies?.[packageName] ?? null;
  return { kind: isLocal(specifier) ? "local" : "registry", specifier };
}

function isLocal(specifier: string | null): boolean {
  if (specifier === null) return false;
  return (
    /^(file|link|portal|workspace|git|git\+[a-z]+|github|gitlab|bitbucket|gist|https?):/.test(
      specifier,
    ) ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("~") ||
    // A GitHub shorthand, `owner/repo` with an optional `#ref`. A scoped
    // registry name starts with `@`, so it never matches.
    /^[^@./][^/]*\/[^/]+$/.test(specifier.split("#")[0] ?? "")
  );
}
