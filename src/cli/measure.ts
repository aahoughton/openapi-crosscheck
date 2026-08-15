import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAdapters, resolveAdapterDirs } from "../adapters/registry";
import { cases, corpusDigest } from "../corpus/index";
import { disposeAll, measure } from "../runner/run";
import { renderCorpus, renderMeasurement } from "../report/render";

/**
 * Ask every named container the corpus and write what they answered.
 *
 * ```
 * pnpm measure adapters/<slug> --out runs/<slug>
 * pnpm measure adapters/* --out report --force
 * ```
 *
 * Containers are named by directory, so measuring a container written outside
 * this repository is the same command as measuring one inside it. What gets
 * compared is chosen here, by which directories are named, rather than later by
 * a flag on a renderer: the directory on disk then matches what was asked.
 *
 * This writes the measurement and nothing else. Markdown and HTML are readings
 * of what lands here, produced by `pnpm render-md` and `pnpm render-html`, and
 * separating them means the thing that measures cannot also be the thing that
 * decides how a measurement looks.
 *
 * The directory is created here and must not already exist. One directory holds
 * one run, so no directory can ever hold answers from two, and a stale file from
 * an earlier roster cannot sit alongside a newer one describing something else.
 * `--force` empties an existing directory first and exists for one caller:
 * `pnpm regenerate`, which rebuilds the committed `report/`.
 *
 * `corpus.json` goes in first and `run.json` last, so the directory says what it
 * is at every point. Questions and no sidecar is a run that died partway, and
 * reading it is how you find out why.
 */
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { positional, flags } = parse(argv);

  if (positional.length === 0) {
    throw new Error(
      "measure needs at least one adapter directory\n" +
        "  pnpm measure adapters/<slug> --out runs/<slug>",
    );
  }
  const out = flags.get("--out");
  if (out === undefined) {
    throw new Error(
      "measure needs --out, a directory to write the run into\n" +
        `  pnpm measure ${positional.join(" ")} --out runs/<name>`,
    );
  }

  // Before the directory is claimed, so a typo can be retried with the same
  // --out rather than colliding with the directory the typo created.
  const directories = resolveAdapterDirs(positional);

  const outDir = resolve(out);
  createRunDirectory(outDir, flags.has("--force"));

  // The questions, before anything is asked. A run that dies mid-roster still
  // says what it was asking.
  writeFileSync(join(outDir, "corpus.json"), renderCorpus(cases), "utf8");

  const adapters = await createAdapters(directories);
  try {
    mkdirSync(join(outDir, "libraries"), { recursive: true });
    for (const adapter of adapters) {
      const measurement = await measure(cases, adapter);
      if (measurement.provenance.kind !== "container") {
        // A fixture answered. Refused rather than written, because a run
        // directory holding one would be indistinguishable from a measurement.
        throw new Error(
          `${measurement.library} was measured through a ${measurement.provenance.kind} adapter, ` +
            "which cannot be published",
        );
      }
      const path = join(outDir, "libraries", `${measurement.provenance.slug}.json`);
      writeFileSync(path, renderMeasurement(measurement), "utf8");
      process.stdout.write(`${measurement.library} ${measurement.libraryVersion} -> ${path}\n`);
    }

    // Last, so its presence is what says the run finished.
    writeFileSync(join(outDir, "run.json"), `${JSON.stringify(runRecord(), null, 2)}\n`, "utf8");
    process.stdout.write(
      `measured ${String(adapters.length)} librar${adapters.length === 1 ? "y" : "ies"} into ${outDir}\n` +
        `  pnpm render-md ${out}\n`,
    );
  } finally {
    await disposeAll(adapters);
  }
}

/**
 * Claim the output directory, or refuse.
 *
 * `mkdir` without `recursive` is the check: it fails when the directory exists,
 * which is the invariant stated as one system call rather than as a test and a
 * race after it.
 */
function createRunDirectory(outDir: string, force: boolean): void {
  if (force) rmSync(outDir, { recursive: true, force: true });
  try {
    mkdirSync(outDir, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `${outDir} already exists, and one directory holds one run\n` +
          "  choose another --out, or pass --force to replace what is there",
      );
    }
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${outDir} cannot be created: its parent directory does not exist`);
    }
    throw error;
  }
}

/**
 * When this run happened and what produced it.
 *
 * The harness revision is read from git and is allowed to be absent: a copy of
 * this repository without git history can still measure, and recording
 * `unknown` says so rather than failing the run or inventing a value. `dirty`
 * matters more than the sha for a report a reader might trust, because a sha
 * with uncommitted changes on top identifies nothing.
 */
function runRecord(): Record<string, unknown> {
  return {
    startedAt: new Date().toISOString(),
    harness: gitDescribe(),
    corpusDigest: corpusDigest(cases),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };
}

function gitDescribe(): Record<string, unknown> {
  try {
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return { revision, dirty: status.trim().length > 0 };
  } catch {
    return { revision: "unknown", dirty: null };
  }
}

/** Adapter directories are positional; everything else is a flag with a value. */
function parse(argv: readonly string[]): {
  positional: string[];
  flags: Map<string, string>;
} {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    if (argument === "--force") {
      flags.set(argument, "");
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${argument} needs a value`);
    flags.set(argument, value);
    index += 1;
  }
  return { positional, flags };
}

await main();
