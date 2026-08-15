import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every source file is committed.
 *
 * The gate runs against the working tree, so a file that exists on disk but is
 * not in the commit passes here and fails for everyone else. That happened: an
 * unanchored `coverage/` line matched `src/coverage/`, git silently skipped the
 * directory, and the gate stayed green locally while the posted sha did not
 * typecheck anywhere else.
 *
 * A green gate on a commit nobody else can build is worse than a red one, so
 * the check is mechanical rather than a habit of running `git status`.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Directories that hold what a tool wrote rather than what a person did:
 * installed packages, and the dot-prefixed caches type checkers and linters
 * leave beside the code they read. A container's checks run in its image, but
 * running one by hand against the directory drops these into it, and demanding
 * they be committed would be demanding the wrong thing.
 */
function isToolDirectory(name: string): boolean {
  return name === "node_modules" || name.startsWith(".");
}

function sourceFiles(dir: string, keep: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(`${repoRoot}/${dir}`, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!isToolDirectory(entry.name)) found.push(...sourceFiles(path, keep));
    } else if (keep(entry.name)) found.push(path);
  }
  return found;
}

describe("the commit contains what the gate ran against", () => {
  // Everything under `adapters/`, whatever it is called. A container's build
  // context is its own directory, so any file in it can be one the image needs,
  // and an untracked one leaves an image that builds here and nowhere else.
  const files = [
    ...sourceFiles("src", (name) => name.endsWith(".ts")),
    ...sourceFiles("test", (name) => name.endsWith(".ts")),
    ...sourceFiles("adapters", () => true),
  ];

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("tracks every source file in git", () => {
    const tracked = new Set(
      execFileSync("git", ["ls-files", "src", "test", "adapters"], {
        cwd: repoRoot,
        encoding: "utf8",
      })
        .split("\n")
        .filter((line) => line !== ""),
    );
    expect(files.filter((file) => !tracked.has(file))).toEqual([]);
  });

  it("has no ignore rule matching a source file", () => {
    // check-ignore exits 1 when nothing matches, which is the passing case.
    let ignored = "";
    try {
      ignored = execFileSync("git", ["check-ignore", "--no-index", ...files], {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch {
      ignored = "";
    }
    expect(ignored.split("\n").filter((line) => line !== "")).toEqual([]);
  });
});
