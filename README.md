# openapi-crosscheck

`openapi-crosscheck` measures how OpenAPI request validation libraries behave
when they receive the same requests and OpenAPI documents.

The rendered report lives at
[aahoughton.github.io/openapi-crosscheck](https://aahoughton.github.io/openapi-crosscheck/),
published by hand from the committed measurements; the measurements themselves
are served beside it. If that link answers nothing yet, nobody has pressed the
button since the last change: the committed JSON and markdown under
[report/](report/) are the same content in this checkout.

It can help answer questions like these:

- Does this library accept or reject the same requests the OpenAPI
  specification says it should?
- Does it return the deserialized parameter values, or only a verdict?
- Which request-validation stages does the library perform itself, and which
  does its caller have to do?
- Where do implementations disagree because the specification leaves the
  behavior open?

It does not measure performance, response validation, security posture,
framework ergonomics, or which library is best overall. No conformance outcome
is totalled across libraries and nothing is ranked.

## Libraries measured

| ecosystem                 | libraries measured                                                                            | start here                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| JavaScript and TypeScript | `express-openapi-validator`, `@oaverify/core`, `openapi-backend`, `openapi-request-validator` | [matrix](report/matrix.oas31.md), [fitness](report/fitness.md), per-library pages        |
| Go                        | `github.com/getkin/kin-openapi`, `github.com/pb33f/libopenapi-validator`                      | [matrix](report/matrix.oas31.md), [fitness](report/fitness.md), per-library pages        |
| Java                      | `com.atlassian.oai:openapi-request-validator-core`                                            | [per-library page](report/libraries/com-atlassian-oai-openapi-request-validator-core.md) |
| PHP                       | `league/openapi-psr7-validator`                                                               | [per-library page](report/libraries/league-openapi-psr7-validator.md)                    |
| Python                    | `openapi-core`                                                                                | [per-library page](report/libraries/openapi-core.md)                                     |
| Ruby                      | `openapi_first`                                                                               | [per-library page](report/libraries/openapi-first.md)                                    |

The current committed report measures:

- `com.atlassian.oai:openapi-request-validator-core`
- `express-openapi-validator`
- `github.com/getkin/kin-openapi`
- `github.com/pb33f/libopenapi-validator`
- `league/openapi-psr7-validator`
- `@oaverify/core`
- `openapi-backend`
- `openapi-core`
- `openapi-request-validator`
- `openapi_first`

> [!NOTE]
> Disclosure: the author of this harness also authors `@oaverify/core`, one of
> the measured libraries. The report includes controls for that conflict: no
> code above the adapter layer names a library, every cell traces to stored raw
> output, conformance cases quote the specification text they rest on, and
> disputes start from the raw per-library JSON, with a defective case or a
> misplaced tier treated on the same footing as a defective adapter.

## How the measurement works

The questions are a corpus of cases. A case is one OpenAPI document, one HTTP
request, and one question about how the specification says that request should
be read. Each library runs in its own container, receives every case it can be
asked, and answers with a verdict, accepted or rejected, and the values it
deserialized. The harness stores each library's unedited answers in
`report/libraries/<slug>.json` and derives every table from that JSON. A
library is never shown the expected answer, and no code above its adapter
knows which library is running.

Conformance cases cite the OpenAPI specification rule that settles the expected
answer. Divergence cases record implementation differences where the
specification leaves room.

Each library runs in its own container. The harness communicates with
containers through [docs/container-protocol.md](docs/container-protocol.md), so
adapters can be written in the library's own language.

## Read the report

- [report/README.md](report/README.md): what a run directory holds, the words
  the reports use, and what to read in which order. Written by the run itself.
- [report/matrix.oas31.md](report/matrix.oas31.md): cross-library conformance
  and divergence results, one matrix file per specification version measured.
- [report/fitness.md](report/fitness.md): what each library does for itself and
  what its caller must supply.
- [report/capabilities.md](report/capabilities.md): what each adapter can ask
  its library and where exposed values are observed.
- [report/coverage.oas31.md](report/coverage.oas31.md): the specification
  surface covered by the corpus, per version, including visible gaps.
- `report/libraries/<slug>.md`: one library on its own, which is what a run
  measuring one library renders and the page to cite when disputing a cell.
- [report/corpus.json](report/corpus.json): the questions asked of the
  libraries.
- `report/libraries/<slug>.json`: one library's measured answers.

The markdown is a reading of that JSON. Every number, cell and case in it is
derived, and no result was typed by hand. The prose around the tables describes
how to read a table; adapter-stated configuration prose is printed as such and
stored beside the raw answers. The section below is how to check that for
yourself.

## Checking this report yourself

Three checks, cheapest first. Each one says something different, and the first
two say nothing about whether the measurements are still true.

You need Node 22 and pnpm, both pinned in `mise.toml`, so `mise install`
provides them. Docker is needed only where a check below says so, and for
measuring.

**Is the markdown really the JSON?** About a minute, no Docker.

```bash
pnpm install
pnpm render-md report && git diff --stat report/
```

An empty diff means every markdown file in `report/` is what the renderer
produces from the committed measurements, so no cell was typed by hand.

**Does the harness do what it claims?** Seconds, no Docker.

```bash
pnpm check
```

Typecheck, lint, and the harness tests: the runner, the scorer, the wire
encoding, the protocol client, the rules the corpus must obey, and the byte
comparison above. It rebuilds the report from the committed measurements, so it
proves the two agree and proves nothing about either matching a library.

**Do the libraries still answer this way?** Minutes, and Docker.

```bash
pnpm check:containers
```

Builds one container per library, installs each library from its public
registry, and asks it every case again. This is the only check that compares
the measurements to the libraries, so it is the only one that can find the
report stale.

No CI runs any of them, so they are gates somebody has to remember, and nothing
committed records when the last one happened. What the report does carry is the
version and image id each library answered from.

`pnpm format` rewrites files the way `pnpm lint` wants them.

## Measure, then render

Measuring and rendering are separate commands. `measure` asks containers and
writes JSON. Rendering reads that JSON back and produces something to look at.

```bash
pnpm measure adapters/<slug> --out runs/<slug>
pnpm render-md runs/<slug>
pnpm render-html runs/<slug>
```

Containers are named by directory, so pointing this at a container you wrote
yourself is the same command as pointing it at one of ours:

```bash
pnpm measure ../my-adapter --out runs/mine
pnpm measure ../my-adapter adapters/<slug> --out runs/mine-vs-one
```

`--out` must not already exist, because one directory holds one run. Which
libraries end up in a picture is decided when they are measured, so a rendered
page always matches something on disk and there is no way to mix two runs.

Rendering reads one directory and nothing else, including the questions, which
come from the `corpus.json` in that directory. A run kept from six months ago
renders against the corpus it was actually asked, on a machine with no Docker
at all. `pnpm regenerate` rebuilds the committed report in `report/`.

The HTML page is a view: nothing compares it and git ignores it.

## Publishing the page

The rendered HTML of the committed report is published to GitHub Pages by the
`publish-page` workflow, triggered by hand from the Actions tab. Publishing is
a decision, so nothing publishes on push. The workflow renders `index.html`
fresh from the committed JSON (the page is a view this repository never
commits) and deploys the whole `report/` directory, so the page and the
measurements behind it are fetchable at sibling URLs.

One-time setup after the repository is public: Settings, Pages, set the source
to GitHub Actions. The site lands at
[aahoughton.github.io/openapi-crosscheck](https://aahoughton.github.io/openapi-crosscheck/),
a URL that is stable across republished runs.

## Repository map

- `src/corpus/`: cases, citations, and corpus construction.
- `src/surface/`: the specification surface the coverage map is drawn against,
  enumerated from the specification rather than from the corpus.
- `src/capability/`: the probes that ask a library which pipeline stages it
  performs, and what the probes saw.
- `src/container/`: Docker lifecycle and the container client.
- `src/adapters/registry.ts`: bringing up an adapter per directory. It holds no
  roster: what gets measured is what the command names.
- `src/wire/`: request shapes, path templates, and what the harness may parse
  on a library's behalf.
- `src/runner/`: running the corpus against the adapters.
- `src/report/`: reading a run directory, the renderers for markdown, JSON and
  HTML, and the scoring that joins a measurement with the corpus.
- `src/cli/`: `measure` (ask containers, write JSON), `render-md` and
  `render-html` (read a run directory, write a reading of it).
- `src/types/`: the shared shapes, including the measurement format.
- `adapters/<slug>/`: one container per library, holding everything that
  container needs: its manifest, its adapter, and its own implementation of the
  protocol. Its build context is that directory, so nothing in it reaches into
  the harness. Each one also checks itself when its image builds, which the
  harness suggests and does not require.
- `test/constitution/`: tests for the measurement rules.
- `test/container/`: tests for the container protocol.
- `test/adapters/`: adapter contract tests.
- `test/pipeline/`, `test/report/`, `test/surface/`: stage attribution, report
  rendering and scoring, and coverage of the specification surface.

Contributor conventions live in [AGENTS.md](AGENTS.md).
