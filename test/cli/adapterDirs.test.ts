import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAdapterDirs } from "../../src/adapters/registry";

function adapterDir(parent: string, name: string): string {
  const dir = join(parent, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "Dockerfile"), "FROM scratch\n");
  return dir;
}

describe("resolveAdapterDirs", () => {
  it("refuses two directories sharing a slug", () => {
    // The slug names the measurement file, so the second would overwrite the first.
    const root = mkdtempSync(join(tmpdir(), "adapters-"));
    const one = adapterDir(join(root, "a"), "lib");
    const other = adapterDir(join(root, "b"), "lib");
    expect(() => resolveAdapterDirs([one, other])).toThrow(/share the slug lib/);
  });

  it("names the same directory twice only once", () => {
    const root = mkdtempSync(join(tmpdir(), "adapters-"));
    const one = adapterDir(root, "lib");
    expect(resolveAdapterDirs([one, one])).toEqual([one]);
  });

  it("refuses a directory with no Dockerfile", () => {
    const root = mkdtempSync(join(tmpdir(), "adapters-"));
    expect(() => resolveAdapterDirs([root])).toThrow(/no Dockerfile/);
  });
});
