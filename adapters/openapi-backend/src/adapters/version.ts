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
 * npm's local spellings are `file:`, `link:` and `portal:`, and a bare path is
 * also accepted by npm for a directory. Anything else is a registry range,
 * including `latest`.
 */
export function readResolution(packageName: string): LibraryResolution {
  const manifest = require("/app/package.json") as { dependencies?: Record<string, string> };
  const specifier = manifest.dependencies?.[packageName] ?? null;
  return { kind: isLocal(specifier) ? "local" : "registry", specifier };
}

function isLocal(specifier: string | null): boolean {
  if (specifier === null) return false;
  return (
    specifier.startsWith("file:") ||
    specifier.startsWith("link:") ||
    specifier.startsWith("portal:") ||
    specifier.startsWith(".") ||
    specifier.startsWith("/")
  );
}
