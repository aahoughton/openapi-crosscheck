import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readRun, sidecarNote } from "../report/read";
import { renderMarkdown } from "../report/render";
import { parseRenderArgs, selectVersions } from "./renderArgs";

/**
 * Write the markdown reading of a run directory, into that directory.
 *
 * ```
 * pnpm render-md report
 * pnpm render-md runs/<slug>
 * ```
 *
 * One argument, and it is the directory holding every measurement being
 * rendered. Which libraries appear was decided when they were measured, so
 * there is no way to render a subset of a directory or to mix two: the picture
 * always matches something that exists on disk, and a reader who wants a
 * different comparison measures a different directory.
 *
 * Reads nothing from this checkout, including the corpus, which comes from the
 * directory. Rendering is then a pure function of what a run holds, and a run
 * from an older harness renders against the questions it was actually asked.
 *
 * Additive: it writes markdown alongside what `measure` wrote and never touches
 * it, so the JSON in a run directory is always exactly what came out of the
 * containers.
 */
async function main(): Promise<void> {
  const { path, versions } = parseRenderArgs(process.argv.slice(2), "render-md");

  const dir = resolve(path);
  const run = readRun(dir);
  if (run.measurements.length === 0) throw new Error(`${dir} holds no measurements to render`);

  const cases = selectVersions(run.cases, versions);
  const artifacts = renderMarkdown(cases, run.measurements);
  for (const [name, content] of Object.entries(artifacts)) {
    const file = join(dir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
  }

  process.stdout.write(
    `wrote ${String(Object.keys(artifacts).length)} markdown files to ${dir} for ` +
      `${String(run.measurements.length)} librar${run.measurements.length === 1 ? "y" : "ies"}\n`,
  );
  const note = sidecarNote(dir, run.sidecar);
  if (note !== null) process.stdout.write(`${note}\n`);
}

await main();
