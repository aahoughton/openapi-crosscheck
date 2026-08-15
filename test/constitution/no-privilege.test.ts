import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * "No code above the adapter layer names a library" is the rule the project's
 * neutrality rests on, so it is enforced mechanically rather than by review
 * attention.
 *
 * Candidate names are read from the manifests that install the libraries rather
 * than written down here. A hand-maintained list in this file would itself be a
 * list of library names above the adapter layer, and would go stale the moment
 * the roster changed.
 *
 * Every manifest under `adapters/`, in every ecosystem, because a list read
 * from this repository's own `package.json` would only ever hold npm names and
 * would silently stop policing a library the day it arrived in another
 * language. The root manifest is read too, and installs no library today: what
 * that reader is for is the day one appears there, because a library the
 * harness itself installs is the one most able to reach above the adapter
 * layer.
 *
 * Two checks, because "names a library" means two different things:
 *
 * 1. A module specifier or string literal holding a package name is coupling.
 *    Always an offence outside the adapter layer, for every package.
 * 2. A bare mention in prose is an offence only for names that cannot be
 *    ordinary English, which is to say names carrying `@`, `/` or `-`. Some
 *    packages are named after common words, and a comment reading "no way to
 *    convey what the case declares" must not be an offence because a package
 *    happens to share the verb.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** The only place library-specific code is allowed to live. */
const EXEMPT_DIRECTORIES = ["src/adapters", "test/adapters"];

interface PackageJson {
  dependencies?: Record<string, string>;
}

/**
 * Every package name any manifest in this repository installs.
 *
 * Read from every manifest format the roster uses. A
 * format nobody uses yet contributes nothing, which is why an adapter in a new
 * language must be accompanied by a reader here: until it is, its library is
 * unpoliced, and `names something from every container` is what says so.
 */
function installedNames(): readonly string[] {
  const names = new Set<string>(manifestNames(join(repoRoot, "package.json")));
  for (const slug of containerSlugs()) {
    for (const name of namesInstalledBy(slug)) names.add(name);
  }
  return [...names].sort();
}

function containerSlugs(): readonly string[] {
  return readdirSync(join(repoRoot, "adapters"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Every package name one container's manifests install, whatever the ecosystem. */
function namesInstalledBy(slug: string): readonly string[] {
  const dir = join(repoRoot, "adapters", slug);
  return [
    ...manifestNames(join(dir, "package.json")),
    ...requirementNames(join(dir, "requirements.txt")),
    ...goModuleNames(join(dir, "go.mod")),
    ...goGetNames(join(dir, "Dockerfile")),
    ...mavenNames(join(dir, "pom.xml")),
    ...composerNames(join(dir, "composer.json")),
    ...gemNames(join(dir, "Gemfile")),
  ];
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Runtime dependencies only. This repository's `devDependencies` are the
 * harness's own tooling, which its tests import by name and must go on being
 * able to import. A container declares everything it needs to run one library
 * as a dependency, so nothing is lost by reading only the one field.
 */
function manifestNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  return Object.keys((JSON.parse(text) as PackageJson).dependencies ?? {});
}

function requirementNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  return text
    .split("\n")
    .map((line) => line.split("#")[0]?.trim() ?? "")
    .filter((line) => line.length > 0)
    .map((line) => line.split(/[[<>=!~;]/)[0]?.trim() ?? "")
    .filter((name) => name.length > 0);
}

/**
 * Module paths a `go.mod` requires, both the block form and the single-line
 * form. The module's own name is skipped: it is this container, not a library.
 */
function goModuleNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  const names: string[] = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = (raw.split("//")[0] ?? "").trim();
    if (line === "require (") {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ")") {
      inBlock = false;
      continue;
    }
    const single = /^require\s+(\S+)/.exec(line);
    if (single?.[1] !== undefined) names.push(single[1]);
    else if (inBlock && line.length > 0) names.push(line.split(/\s+/)[0] ?? "");
  }
  return names.filter((name) => name.length > 0);
}

/**
 * Modules a Dockerfile fetches with `go get`.
 *
 * A Go container resolves its library at image build time, the same policy the
 * npm containers get from `latest`, so its `go.mod` names the module being
 * built and not the library under test. The Dockerfile is where the name is,
 * and reading it is what keeps a Go library policed like any other.
 */
function goGetNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  return [...text.matchAll(/go\s+get\s+(\S+)/g)].map(
    (match) => (match[1] ?? "").split("@")[0] ?? "",
  );
}

/**
 * Packages a `composer.json` requires.
 *
 * The runtime section only, matching the rule for every other manifest here.
 * The language's own version constraint sits in the same object under a name
 * that is not a package, so it is dropped.
 */
function composerNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  const required = (JSON.parse(text) as { require?: Record<string, string> }).require ?? {};
  return Object.keys(required).filter((name) => name.includes("/"));
}

/**
 * Gems a `Gemfile` declares.
 *
 * Every group, unlike the other manifests, because a Gemfile puts checking
 * tools in a named group rather than in a separate file and the group name is
 * not visible from one line. Reading them all can only over-police.
 */
function gemNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  return [...text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((match) => match[1] ?? "");
}

function mavenNames(path: string): readonly string[] {
  const text = readIfPresent(path);
  if (text === null) return [];
  return [...text.matchAll(/<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>/g)].map(
    (match) => `${match[1] ?? ""}:${match[2] ?? ""}`,
  );
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return found;
}

function escape(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** The package name inside quotes: an import specifier, or any string literal holding it. */
function referencesSpecifier(text: string, name: string): boolean {
  return new RegExp(`['"\`]${escape(name)}(/[^'"\`]*)?['"\`]`).test(text);
}

/** The package name as a bare token in prose. */
function mentionsInProse(text: string, name: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9@_/-])${escape(name)}($|[^A-Za-z0-9_/-])`).test(text);
}

/** Names that cannot be mistaken for ordinary English. */
function isDistinctiveName(name: string): boolean {
  return /[@/-]/.test(name);
}

describe("no library is privileged", () => {
  const libraryNames = installedNames();
  const files = [...sourceFiles("src"), ...sourceFiles("test")].filter(
    (file) => !EXEMPT_DIRECTORIES.some((dir) => file.startsWith(`${dir}/`)),
  );

  it("has libraries and files to check", () => {
    expect(libraryNames.length).toBeGreaterThan(0);
    expect(files.length).toBeGreaterThan(0);
  });

  // A container whose manifest format nothing here reads contributes no names,
  // so its library would be unpoliced and every check below would pass by
  // knowing nothing about it. Failing here is what turns that into a visible
  // task: add a reader for the format.
  it("reads a name from every container", () => {
    const silent = containerSlugs().filter((slug) => namesInstalledBy(slug).length === 0);
    expect(silent).toEqual([]);
  });

  it("imports no library outside the adapter layer", () => {
    const offences: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), "utf8");
      for (const name of libraryNames) {
        if (referencesSpecifier(text, name)) offences.push(`${file} references ${name}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("mentions no distinctively named library outside the adapter layer", () => {
    const offences: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), "utf8");
      for (const name of libraryNames.filter(isDistinctiveName)) {
        if (mentionsInProse(text, name)) offences.push(`${file} mentions ${name}`);
      }
    }
    expect(offences).toEqual([]);
  });

  // The two checks above are keyed on the installed package name, and a name
  // carrying an ecosystem prefix is only ever policed in full. A person writing
  // an example does not write the prefix, so a library whose package name is a
  // module path or a group and artifact pair could be named freely by the
  // short name its directory uses, which is the name a reader recognises. The
  // directory names are the missing key, and any of them appearing as a path
  // outside the adapter layer is a library named in code by construction.
  it("points no path at one container outside the adapter layer", () => {
    const offences: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), "utf8");
      for (const slug of containerSlugs()) {
        if (referencesContainerPath(text, slug)) offences.push(`${file} points at ${slug}`);
      }
    }
    expect(offences).toEqual([]);
  });
});

/** A container's directory named as a path segment, wherever the path starts. */
function referencesContainerPath(text: string, slug: string): boolean {
  return new RegExp(`[A-Za-z0-9_-]+/${escape(slug)}($|[^A-Za-z0-9_/-])`).test(text);
}
