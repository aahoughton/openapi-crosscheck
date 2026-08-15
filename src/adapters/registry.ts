import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Adapter } from "../types/adapter";
import { connect } from "../container/client";
import { buildImage, ecosystemOf, startContainer, stopContainer } from "../container/docker";

/**
 * Bring up an adapter per directory and connect to each one.
 *
 * A directory rather than a name from a roster kept here. A roster would make
 * editing this file the only way into the harness; a path argument puts a
 * container written elsewhere on exactly the terms of the ones in `adapters/`.
 *
 * Order comes from the library name each container reports at `/describe`,
 * which is the ordering key everywhere else, so the roster cannot disagree with
 * the artifacts. It costs the one place where the roster could be read in full,
 * and buys that no hand-maintained order can drift from the measured one.
 *
 * Built and started in parallel because the corpus is not run until all of them
 * answer, and a serial build of seven images is most of the wall clock of a run.
 * If any one fails, every start attempt is allowed to settle and every container
 * that started is stopped before the error is raised, so a failed run does not
 * leave containers behind.
 */
export async function createAdapters(dirs: readonly string[]): Promise<readonly Adapter[]> {
  const directories = resolveAdapterDirs(dirs);
  const started: string[] = [];

  const results = await Promise.allSettled(
    directories.map(async (dir) => {
      const imageId = await buildImage(dir);
      const container = await startContainer(dir, imageId);
      started.push(container.containerId);
      return connect(
        {
          baseUrl: container.baseUrl,
          dispose: () => stopContainer(container.containerId),
        },
        {
          kind: "container",
          slug: container.slug,
          imageId: container.imageId,
          ecosystem: ecosystemOf(dir),
        },
      );
    }),
  );

  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed.length > 0) {
    await Promise.all(started.map(stopContainer));
    throw failed[0]?.reason;
  }

  const adapters = results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  return [...adapters].sort((one, other) => ascii(one.library, other.library));
}

/**
 * Check every path names something that can build a container, and resolve it.
 *
 * Separate from bringing them up so a caller can refuse a typo before doing
 * anything it would have to undo. `measure` calls it before claiming its output
 * directory: a bad path that had already created the directory would fail the
 * retry too, with a message about the directory rather than about the typo.
 */
export function resolveAdapterDirs(dirs: readonly string[]): readonly string[] {
  return dirs.map(adapterDirectory);
}

/**
 * A directory that can build a container, or an error naming what is missing.
 *
 * The Dockerfile is what the harness needs and the only thing it checks for. A
 * path that is merely wrong is refused here, before several minutes of building
 * everything else, rather than surfacing as a build failure further down.
 */
function adapterDirectory(dir: string): string {
  const path = resolve(dir);
  if (!existsSync(join(path, "Dockerfile"))) {
    throw new Error(`${dir} is not an adapter directory: no Dockerfile in ${path}`);
  }
  if (basename(path).length === 0) throw new Error(`${dir} has no directory name to use as a slug`);
  return path;
}

/**
 * Ordered by code unit, so `@` sorts before letters as a property of ASCII
 * rather than as a preference of anyone's.
 */
function ascii(one: string, other: string): number {
  return one < other ? -1 : one > other ? 1 : 0;
}
