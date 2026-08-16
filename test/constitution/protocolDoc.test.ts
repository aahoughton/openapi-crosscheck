import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION } from "../../src/types/container";

/**
 * The protocol document states a version, and this is what keeps it true.
 *
 * `docs/container-protocol.md` is the contract. A container written from it
 * alone has satisfied everything asked of it, which is the point of writing it
 * down, and it means the document is the only thing some container authors will
 * read. The harness refuses any container whose `protocol` is not exactly
 * `PROTOCOL_VERSION`, so a document naming an older version sends someone to
 * build a container the harness will not speak to, and the error they get names
 * a number they never saw.
 *
 * Nothing checked this until protocol 3, when the constant and the document were
 * bumped by hand in the same change and either could have been missed. The
 * changelog is checked too: a bump with no entry leaves ten container
 * maintainers with a version number and no statement of what to do about it,
 * which is the one thing that file exists for.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function doc(name: string): string {
  return readFileSync(new URL(`../../docs/${name}`, import.meta.url), "utf8");
}

describe("the protocol document", () => {
  it("names the version the harness speaks", () => {
    expect(doc("container-protocol.md").split("\n")[0]).toBe(
      `# Container protocol, version ${String(PROTOCOL_VERSION)}`,
    );
  });

  it("states the version in its prose, not only in its examples", () => {
    // The prose escaped the checks below, which match the heading and the JSON
    // examples. The version section said 2 while the constant said 3, and a
    // container author reading that section builds something the harness
    // refuses at the handshake.
    const section = doc("container-protocol.md").split("## Protocol version")[1] ?? "";
    expect(section).toContain(`\`protocol\` is \`${String(PROTOCOL_VERSION)}\``);
    // Built from the constant rather than written out. A hardcoded number here
    // passes the next bump while the document still names the old one, in the
    // test whose whole job is catching that.
    const otherVersion = new RegExp(`\`protocol\` is \`(?!${String(PROTOCOL_VERSION)}\\b)\\d+\``);
    expect(section).not.toMatch(otherVersion);
  });

  it("shows that version in every example message carrying one", () => {
    // The examples are what a container author copies. One left at an older
    // version is a container that fails the describe handshake, and the
    // handshake is the first thing it does.
    const stated = [...doc("container-protocol.md").matchAll(/"protocol": (\d+)/g)].map((match) =>
      Number(match[1]),
    );
    expect(stated.length).toBeGreaterThan(0);
    expect([...new Set(stated)]).toEqual([PROTOCOL_VERSION]);
  });

  it("carries a changelog entry for the version it speaks", () => {
    const headings = [...doc("protocol-changelog.md").matchAll(/^## (\d+)$/gm)].map((match) =>
      Number(match[1]),
    );
    expect(headings).toContain(PROTOCOL_VERSION);
    // Newest first, and every version down to 1 accounted for. A gap is a
    // version somebody bumped past without saying what changed.
    expect(headings).toEqual(
      Array.from({ length: PROTOCOL_VERSION }, (_, index) => PROTOCOL_VERSION - index),
    );
  });

  it("is reachable from the repository root, so the check covers what people read", () => {
    expect(readFileSync(`${repoRoot}/AGENTS.md`, "utf8")).toContain("docs/container-protocol.md");
  });
});
