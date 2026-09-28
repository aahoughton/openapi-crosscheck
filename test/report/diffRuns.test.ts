import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * `pnpm diff-runs` as a reader runs it, on files it has to refuse.
 */

const root = fileURLToPath(new URL("../..", import.meta.url));
const reportDir = join(root, "report");
const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function diffRuns(...args: string[]): { status: number | null; stderr: string } {
  const run = spawnSync("pnpm", ["--silent", "diff-runs", ...args], { cwd: root, encoding: "utf8" });
  return { status: run.status, stderr: run.stderr };
}

describe("diff-runs", () => {
  it("refuses a measurement written under another schema version, naming the file", () => {
    const name = readdirSync(join(reportDir, "libraries")).find((file) => file.endsWith(".json"));
    if (name === undefined) throw new Error("the committed report holds no measurement");
    const committed = join(reportDir, "libraries", name);
    const dir = mkdtempSync(join(tmpdir(), "oxc-diff-"));
    made.push(dir);
    const stale = join(dir, name);
    const parsed = JSON.parse(readFileSync(committed, "utf8")) as Record<string, unknown>;
    writeFileSync(stale, JSON.stringify({ ...parsed, schemaVersion: 0 }));

    const result = diffRuns(committed, stale);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${stale} was written under measurement schema 0`);
  });
});
