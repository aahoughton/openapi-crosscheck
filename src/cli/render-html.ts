import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readRun, sidecarNote } from "../report/read";
import { renderHtml } from "../report/html";
import {
  matrixFileName,
  orderSources,
  presentVersions,
  resolveLabels,
  type EntrySource,
} from "../report/view";
import { parseRenderArgs, selectVersions } from "./renderArgs";

/**
 * Write the HTML reading of a run directory, into that directory.
 *
 * ```
 * pnpm render-html report
 * pnpm render-html runs/<slug>
 * ```
 *
 * The same one-directory rule as `render-md`, and it buys more here: a page
 * built from several directories would have to reconcile runs that were asked
 * different questions, and one directory carries one corpus by construction.
 *
 * The page is a view and nothing compares it, so it is not a committed
 * artifact. `report/index.html` is ignored by git for that reason.
 */
async function main(): Promise<void> {
  const { path, versions } = parseRenderArgs(process.argv.slice(2), "render-html");

  const dir = resolve(path);
  const run = readRun(dir);
  if (run.measurements.length === 0) throw new Error(`${dir} holds no measurements to render`);
  const cases = selectVersions(run.cases, versions);

  const sources: EntrySource[] = run.measurements.map((measurement) => ({
    measurement,
    explicitLabel: null,
    runStartedAt: run.sidecar.kind === "read" ? run.sidecar.sidecar.startedAt : null,
    source: join(dir, "libraries", `${measurement.provenance.slug}.json`),
  }));
  const entries = resolveLabels(orderSources(sources));

  const file = join(dir, "index.html");
  // Asked of the directory rather than assumed. `render-md` is a separate
  // command over the same directory, and the page says where the quoted rules
  // are only when they are there to be read.
  const companions = {
    markdown: presentVersions(cases).every((version) =>
      existsSync(join(dir, matrixFileName(version))),
    ),
  };
  writeFileSync(file, renderHtml(cases, entries, run.sidecar, companions), "utf8");
  process.stdout.write(
    `wrote ${file} from ${String(entries.length)} measurement` +
      `${entries.length === 1 ? "" : "s"}: ${entries.map((entry) => entry.label).join(", ")}\n`,
  );
  const note = sidecarNote(dir, run.sidecar);
  if (note !== null) process.stdout.write(`${note}\n`);
}

await main();
