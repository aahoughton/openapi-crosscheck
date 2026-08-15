import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { Ecosystem } from "../types/adapter";

const run = promisify(execFile);

/**
 * Which public registry an adapter installs its library from, read from the
 * manifest sitting in its directory.
 *
 * Evidence rather than declaration. The manifest is the file that performed the
 * install, so naming the ecosystem from it cannot disagree with what happened;
 * a field the container reported would be a claim nothing checks.
 */
export function ecosystemOf(dir: string): Ecosystem {
  if (existsSync(join(dir, "package.json"))) return "npm";
  if (existsSync(join(dir, "requirements.txt"))) return "pypi";
  if (existsSync(join(dir, "go.mod"))) return "go";
  if (existsSync(join(dir, "pom.xml"))) return "maven";
  if (existsSync(join(dir, "composer.json"))) return "packagist";
  if (existsSync(join(dir, "Gemfile"))) return "rubygems";
  return "unknown";
}

/** Where a running container can be reached, and what is running in it. */
export interface RunningContainer {
  readonly slug: string;
  readonly containerId: string;
  /** The content-addressed id of the image that answered. */
  readonly imageId: string;
  readonly baseUrl: string;
}

/**
 * Build the image for one library's container, from its directory.
 *
 * Build context is the container's own directory, which is what makes the
 * containers comparable: none of them can copy anything from the harness, so a
 * container written here has no advantage over one written by a library owner
 * who only read docs/container-protocol.md. The library resolves its current
 * release at build time, so the resolved version answers what was measured and
 * the image id identifies the built environment that answered.
 */
export async function buildImage(dir: string): Promise<string> {
  const tag = `openapi-crosscheck/${basename(dir)}:latest`;
  await run("docker", ["build", "-t", tag, "."], {
    cwd: dir,
    maxBuffer: 64 * 1024 * 1024,
  });
  const { stdout } = await run("docker", ["image", "inspect", "--format", "{{.Id}}", tag]);
  return stdout.trim();
}

/**
 * Start a container and wait until it answers.
 *
 * The published port is chosen by the host rather than fixed, so containers for
 * several libraries can run at once and a stale container from an earlier run
 * cannot silently answer for this one.
 */
export async function startContainer(dir: string, imageId: string): Promise<RunningContainer> {
  const slug = basename(dir);
  const { stdout: idOut } = await run("docker", [
    "run",
    "-d",
    "--rm",
    "-p",
    "127.0.0.1:0:8080",
    imageId,
  ]);
  const containerId = idOut.trim();

  try {
    const { stdout: portOut } = await run("docker", ["port", containerId, "8080"]);
    const port = Number(portOut.trim().split("\n")[0]?.split(":").pop());
    if (!Number.isInteger(port) || port <= 0) throw new Error(`no published port: ${portOut}`);
    const baseUrl = `http://127.0.0.1:${String(port)}`;
    await waitUntilAnswering(baseUrl, containerId);
    return { slug, containerId, imageId, baseUrl };
  } catch (error) {
    await stopContainer(containerId);
    throw error;
  }
}

/**
 * Poll `/describe` until the container answers.
 *
 * A container that exits during startup is reported with its own logs attached.
 * Left to time out instead, a broken image looks like a slow one, and the run
 * would report a library as unmeasurable when the image never started.
 */
async function waitUntilAnswering(baseUrl: string, containerId: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = "no attempt made";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/describe`);
      if (response.ok) return;
      lastError = `status ${String(response.status)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (!(await isRunning(containerId))) {
      throw new Error(`container exited during startup: ${await logsOf(containerId)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `container did not answer within 30s (${lastError}): ${await logsOf(containerId)}`,
  );
}

async function isRunning(containerId: string): Promise<boolean> {
  try {
    const { stdout } = await run("docker", [
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerId,
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function logsOf(containerId: string): Promise<string> {
  try {
    const { stdout, stderr } = await run("docker", ["logs", "--tail", "20", containerId]);
    return `${stdout}${stderr}`.trim() || "no logs";
  } catch {
    return "logs unavailable";
  }
}

export async function stopContainer(containerId: string): Promise<void> {
  try {
    await run("docker", ["stop", "-t", "1", containerId]);
  } catch {
    // Already gone. `docker run --rm` removes it on exit, so a stop that finds
    // nothing is the normal path rather than a failure.
  }
}
