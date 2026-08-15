import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every adapter directory in this repository.
 *
 * Read from the filesystem rather than listed, because `createAdapters` takes
 * directories now and a hand-written list here would be the roster the registry
 * stopped holding, in a place with less reason to be right.
 */
export function adapterDirs(): readonly string[] {
  const dir = fileURLToPath(new URL("../../adapters", import.meta.url));
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name))
    .sort();
}
