# AGENTS.md: conventions for this repository

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md`.

This repository measures how OpenAPI request validation libraries behave on the
same inputs. It is a measurement instrument, so its conventions are mostly about
keeping library-specific influence out of the measurement.

## Measurement rules

**No library is privileged.** There is no reference implementation, no baseline,
and nothing anyone is compared against. Libraries appear alphabetically
everywhere: in the roster, in fixtures, in code, in output columns. No code above
the adapter layer names a library or branches on which one is running.

**Every cell traces to raw output.** A matrix whose cells cannot be traced back
to what the library actually returned is presentation rather than measurement.
Store each library's unmodified result and make the report derive from it.

The measurement is the JSON and it is **per library**. `report/corpus.json` holds
the questions; `report/libraries/<slug>.json` holds one library's answers and
refers to no other library. Markdown is a reading of that JSON, so a reader who
wants a different presentation has the measurement without needing the renderer.

Measurements carry **no scores**. Scoring needs the expected verdict and values,
which adapters are forbidden from seeing, and a score baked into the artifact
puts the judgement beyond the reach of anyone re-reading the answer. Score is
derived when a measurement is joined with the corpus, which is display's job.
Comparison is display over more than one measurement, and a single-library run
is the ordinary path rather than a degenerate matrix.

**Two tiers, structurally separate.**

- *Conformance*: the specification settles the question. Attribute pass or fail.
- *Divergence*: implementations disagree and the specification does not settle
  it. Report that they differ and what each returned. Attribute failure to nobody.

A conformance case requires a specification citation carrying a section anchor,
the quoted text, and the OpenAPI version it applies to. No citation, no
conformance tier. That rule keeps tier placement tied to specification text.

**Coverage is published including the gaps.** Per-case rigour does not prevent
selection effects: every case can be defensible while the corpus tilts through
what got covered. Enumerate the specification surface, write cases to fill it,
and publish the coverage map with unfilled cells visible. A visibly empty cell
is part of the result. An unlisted one is not.

**Capability differences are reported, never flattened.** "This library does not
expose deserialized values" and "this library returned no values" are different
facts, and a report that renders both as an empty cell loses that distinction.

## Libraries under test

Every library runs in its own container. `adapters/<slug>/` holds a Dockerfile,
a manifest installing that one library, an entry point, and that container's own
implementation of the protocol. The harness speaks only the container protocol
in `docs/container-protocol.md`, so adding a library in any language means
writing a container that answers it, and nothing above the adapter layer
changes. The slug is the package name with characters outside `[a-z0-9-]`
replaced by `-`, and it is a directory name only; the package name stays the
ordering key everywhere.

A container's build context is its own directory. Nothing in it can copy from
the harness, which keeps a container written here on the same terms as one
written by a library owner from the protocol document alone. The cost is that
the JavaScript containers hold duplicate copies of a protocol server, and that
is the right cost: a copy that drifts is caught by the same test that checks
every other container, and the alternative privileges one language.

**The harness has no opinion about how a container is built.** The protocol
suite in `test/container/protocol.test.ts` and the two-sided control in
`test/adapters/control.test.ts` are the whole contract; a container that passes
both has satisfied everything asked of it. An adapter bug does not announce
itself, it produces a cell that looks like a measurement in whichever branch
the corpus exercises rarely, so the containers written here each check
themselves as hard as their language allows:

| container | what it runs |
| --- | --- |
| JavaScript | `tsc --noEmit` under a stricter config than this repository's, then `oxlint --deny-warnings` |
| Go | `go vet`, then `staticcheck` |
| Java | `javac -Xlint:all -Werror` |
| PHP | `php -l`, then `phpstan` at `level: max` |
| Ruby | `ruby -c`, then `rubocop` over the departments that find mistakes rather than preferences |
| Python | `mypy --strict`, then `ruff` over the rules in its `ruff.toml` |

Those checks have each caught a real mistake here: `staticcheck` a
`libraryError` path nothing reached, and `mypy --strict` a parameter map
indexed with a key that could be `None`.

**Capability claims are probed, never inferred.** Every stage is probed
two-sidedly, declared or disclaimed, and what the probe saw is stored per
library and published. A probe demonstrates ownership and almost never refutes
it: a library that performs a stage incorrectly and a library that does not
perform it both reject the valid side, and treating a failed probe as absence
would let a library move its attributable failures into `stageNotOwned` by
disclaiming. So the gate fails only on the three constructible contradictions,
listed in `docs/adding-an-adapter.md`; each fires positively and none reads an
absence. A declared stage no probe showed is published as an unbacked claim
naming the probes that showed nothing, and a container that cannot compare the
input it handed over is published as a gap in the measurement rather than a
clean result.

**Committed containers install from the public registry.** Every container
under `adapters/`, and so everything under `report/`, installs the library
under test from its public package source at the current release resolved
during the image build: no `file:` dependencies, workspace links, vendored
library sources, or path references outside this repository. Every library is
driven through its **published public API**; something reachable only through
an internal subpath is a documented adapter limitation rather than a reason to
reach in. Record the resolved version in the output: `latest` and
reproducibility are in tension, and the recorded resolution is what lets a run
be reproduced and makes pinning a change of policy rather than a rewrite.

That rule governs the committed containers and the committed report, and stops
there. `pnpm measure` takes any directory that can build a container, so a
library author grading an unreleased build writes a container of their own, and
a scratch run nobody commits publishes nothing. `docs/adding-an-adapter.md` has
the recipe, including how to dispute a measurement.

## Probe design

The most important convention here, and the easiest to miss.

A rule enforced in one code branch and missing from its sibling is invisible to
any probe that exercises both branches identically. So:

> For every dimension the corpus varies, name what it holds **constant**. The
> constant is the blind spot.

Usual constants worth turning into dimensions: the identifier is the declared one
(vary: foreign, missing, duplicated), the value is well-formed for its declared
type (vary: well-formed for a different type), the wire shape matches the
declared style, exactly one parameter is declared, the container is non-empty
(empty and empty-after-parsing are different cases), casing and encoding are
canonical.

Volume is not the variable. A corpus of thousands is blind to whatever it holds
fixed, and so is a fuzzer, which samples the space it was told about. When adding
generated cases, state which dimensions vary and which stay fixed, and seed the
generator so a failure reproduces.

## Stack and commands

TypeScript, vitest, pnpm.

```bash
pnpm install
pnpm check            # the fast gate: typecheck, lint, harness tests. Seconds.
pnpm check:containers # the slow gate: builds and starts a container per library.
pnpm regenerate       # rebuild the committed report, containers and all
```

Measuring and rendering are separate programs, and a run directory is what
passes between them.

```bash
pnpm measure <adapter-dir>... --out <dir>   # containers answer; writes JSON
pnpm render-md <dir>                        # markdown, into that directory
pnpm render-html <dir>                      # index.html, into that directory
pnpm diff-runs <a> <b>                      # what moved between two measurements
```

Containers are named by directory, so measuring one written outside this
repository is the same command as measuring one inside it. `--out` is required
and must not exist: one directory holds one run, so no directory can hold
answers from two. `--force` empties an existing directory and exists for
`pnpm regenerate`. `corpus.json` is written first and `run.json` last, so a
directory holding questions and no sidecar is a run that died partway.

`diff-runs` scores nothing and reads no corpus of its own. Either side is a
measurement file or a run directory holding one, and the two need not be the
same library: one library across a change differs in the same way two libraries
do over one corpus. It refuses when the two answered different corpora, because
a case id without the question behind it names nothing.

Rendering takes one directory and nothing else, including the corpus, which
comes from the directory rather than from this checkout. Which libraries appear
was decided when they were measured, so a picture always matches something on
disk.

## Two gates, and when each one is required

`pnpm check` needs no Docker. It covers the harness: the runner, the scorer, the
surface, the wire encoding, the protocol client against an in-process server,
every rendered byte of the committed report, and every property the committed
measurements must have.

`pnpm check:containers` builds and starts a container per library. It is the
adapter contract, and the only thing that says the committed measurements are
still what the libraries do.

Run `pnpm check:containers` before committing anything under `report/`, and when
touching `adapters/**`, `src/container/**` or `src/adapters/**`. The fast gate
proves the markdown matches the JSON. Nothing in it proves the JSON matches
reality, so a stale measurement renders green.

`vitest.config.ts` lists the container tests by name. A test that starts needing
Docker is added there by hand, so what costs minutes stays visible.

## Prose style

Applies to docs, comments, commit messages and generated output.

- No em-dashes. Use a period, comma, semicolon, parenthesis or colon.
- No contrastive negation ("not X, it's Y", "not just X but Y"). Make the
  affirmative claim.
- No filler or stacked hedging.
- No "robust", "powerful", "seamless", "comprehensive", "leverage", "delve".
  Substantiate concretely or drop the word.
- Generated output (reports, error messages, logs) is ASCII, simple and concise.
  Data passed through from a specification or a library's own output is
  unchanged.

## Commits

Conventional subjects (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). ASCII only.
No attribution trailers or generated-by footers. Commit each logically
independent, tested change separately.
