# Adding an adapter

For a library owner who wants their library measured here, or who wants to
dispute a measurement.

Every library runs in its own container answering
[the container protocol](container-protocol.md). That document is the contract
and explains why each field is shaped the way it is. This one is the practical
path through it, and the two are meant to be read in that order: protocol first,
this second.

## What you are agreeing to

Four things constrain what an adapter may do, and they are what make the
comparison worth reading.

**The library is driven through its published public API.** Something reachable
only through an internal or unexported path is a documented adapter limitation
rather than a reason to reach in. If your library can answer a question only
through an internal call, the published result is that it cannot answer it through
its published surface, and that is a fact about what a caller can rely on.

**The container is self-contained.** Its build context is its own directory, so
nothing in it can copy anything from the harness. Everything it needs lives
beside its Dockerfile, including its implementation of the protocol. The
JavaScript containers each carry their own copy of a protocol server, and those
copies are duplicates of one another on purpose: a shared one would make an
adapter written here cheaper to write than one written by a library owner who
only read the protocol document, and the containers would stop being comparable.

**The container never sees the expected answer.** It receives a case id, a
document and a request. It does not receive the expected verdict, the expected
values or the citations, and it cannot ask for them. That keeps the corpus
separate from a library whose adapter its own maintainer wrote.

**Capability declarations are probed and published.** `/describe` says which
pipeline stages your library performs. Every stage is probed two-sidedly when
your library is measured, whether you declared it or disclaimed it, and what the probe saw
is stored with your library's measurement and rendered in
`report/capabilities.md`.

Declare the stages your library performs. Correctness is a separate question,
reported separately in the matrix. Ownership is who does the work: your library
owns a deserialization stage if it converts the raw value itself rather than
requiring its caller to. A library that owns a stage and produces the unexpected
answer belongs in those cells, where the failure is attributable to it.

The gate fails on contradiction only, and three are constructible: a splitting
claim where your library answers with the location supplied and not without it,
an exposure claim answered by `unexposed`, and a disclaimed exposure while your
container reports that the library wrote deserialized values back onto the
input it was handed, which is a value channel whatever the published API
returns. A declared stage no probe could
show is published as an unbacked claim, with the probes that showed nothing
named beside it. That is a finding about the measurement rather than a failure,
and it is the row to look at when a probe appears mismatched to the library.

## The five steps

1. **Create a directory named for your library.** The slug is your package name
   with characters outside `[a-z0-9-]` replaced by `-`, and it names the
   measurement file. It is a directory name only: the package name your
   container reports at `/describe` is the ordering key everywhere, and columns
   come out in alphabetical order of it whatever the directories are called.
   Ordering reads from the first letter or digit, so a leading `@` or any other
   ecosystem punctuation puts nobody at the head of the roster.

2. **Install from the public registry at the current release.** npm `latest`,
   PyPI, Go modules, Maven Central: whatever your ecosystem's public resolution
   is. No `file:` dependencies, workspace links, vendored sources or paths
   outside this repository. The resolved version is read at runtime from the
   installed package rather than written into the image by hand, and it is
   recorded in the output. Pinning is a change of policy rather than a local
   choice.

   This governs a container that lands in `adapters/` and the report published
   from it. Measuring a build that is not released yet is a different thing and
   is the point of the next section.

3. **Answer `/describe` and `/run`.** The protocol document gives both message
   shapes in full. Five details are worth calling out:

   - The request target arrives base64-encoded and must not be passed through a
     URL parser of your own before your library sees it. Percent-encoding is a
     probe dimension, and a parser that normalises it deletes exactly the cases
     the corpus exists to run.
   - Headers arrive as an ordered list of pairs. Duplicate names and
     non-canonical casing are probe dimensions, and a map collapses both.
   - `preparsed` carries what the harness split for you, per location, and
     `null` for a location means it split nothing there. Do not read a location
     you declared your library recovers itself: nothing in the protocol can
     detect it, and the resulting cell would credit your library with the
     harness's work.
   - The value channel has three constructors, and they mean different things.
     `observed` with a vantage, `unexposed` when your library has no API that
     returns values at any input, `notReached` when it has one and did not get
     that far. A report that rendered all three the same would lose information,
     so the protocol makes you pick.
   - `inputMutation` is the other value channel. Snapshot whatever you hand your
     library, compare it after the call, and say what you compared. If your
     library writes deserialized values onto your request object, its callers
     can read them there, and that is an exposure whatever your published API
     returns. If you cannot compare what you handed over, say `notCompared` and
     why: an explicit gap is published as a gap, and a `none` that compared
     nothing would be published as a result.

4. **Measure it.** Name your directory; there is no roster to join.

   ```bash
   pnpm measure ./my-adapter --out runs/mine
   pnpm render-md runs/mine
   ```

   Your directory can live anywhere. A container kept in your own repository is
   measured by the same command as one in `adapters/`.

5. **Run `pnpm check:containers`.** It needs a working Docker daemon and holds
   your container to the protocol suite and the two-sided control. It builds
   every container in `adapters/`, so a cold run is minutes and a warm one is
   under a minute. `pnpm check` is the fast gate and needs no Docker; it does
   not exercise your container.

## Measuring an unreleased build

The most useful hour this instrument buys a library author is grading a fix
before it ships, and the harness already does it: `pnpm measure` takes any
directory that can build a container, so a scratch adapter installing your
working tree is measured by the same command as a committed one.

Nothing about that reaches the published report. The registry rule above is
about what this repository publishes, and a run directory of your own publishes
nothing.

```bash
# in your library's repository, build a tarball of the working tree
npm pack --pack-destination /tmp/x

# a scratch adapter, outside this repository, installing that tarball
cp -r adapters/<nearest-container> /tmp/x/adapter-local
cp /tmp/x/<your-library>-<version>.tgz /tmp/x/adapter-local/
cd /tmp/x/adapter-local
# point the manifest at the tarball instead of the registry, and add a line to
# the Dockerfile beside the existing COPY of the manifest:
#   COPY <your-library>-<version>.tgz ./<your-library>-<version>.tgz

# back in this repository
pnpm measure /tmp/x/adapter-local --out /tmp/x/run-local
pnpm render-md /tmp/x/run-local
```

The run says which it is. `libraryVersion` is read from the installed package,
and an unreleased tree carries the last released version in its manifest, so a
local run records the release you branched from rather than the code you
measured. `libraryResolution` beside it carries the specifier your manifest
asked for, so the rendered page and the markdown both say the version is the
release this build came from, and `imageId` is what tells two such runs apart.

To see what a fix moved, measure before and after into two directories and hand
both to `diff-runs`:

```bash
pnpm diff-runs /tmp/x/run-before /tmp/x/run-after
```

It groups what moved: verdicts that changed, values that changed while the
verdict held, and cases that entered or left `unsupported`, which is the group a
text diff over rendered markdown most easily obscures. It scores nothing, and it refuses
two runs over different corpora rather than comparing case ids that name
different questions.

## Checking your own code, which nobody makes you do

Nothing here asks you to. The protocol test and the two-sided control are the
contract, and how you check your own code is your business.

It is worth doing anyway, and worth more here than in most projects. Nothing
outside your directory reads your code, and an adapter bug does not announce
itself: it produces a cell that looks like a measurement, usually in a branch
the corpus exercises rarely. Both kinds of failure are quiet.

The containers here run these as build steps, offered as a starting point:

| container  | what it runs                                  |
| ---------- | --------------------------------------------- |
| JavaScript | `tsc --noEmit`, then `oxlint --deny-warnings` |
| Go         | `go vet`, then `staticcheck`                  |
| Java       | `javac -Xlint:all -Werror`                    |
| PHP        | `php -l`, then `phpstan` at `level: max`      |
| Ruby       | `ruby -c`, then `rubocop`                     |
| Python     | `mypy --strict`, then `ruff`                  |

Both of the findings worth having came from the deeper tool rather than the
compiler: `staticcheck` found a `libraryError` path nothing reached, and
`mypy --strict` found a parameter map indexed with a key that could be `None`.
Neither would have failed a build or a test.

If your language has nothing to offer, say so in your Dockerfile and move on.
An empty check labelled as such is better than a check that only proves the
file parses.

## What the gate will hold you to

- `test/container/protocol.test.ts`: the message shapes, the closed sets, and a
  declaration for every stage and every splitting location. An omitted field
  arrives as `undefined` and would read as a disclaim you never made.
- `test/adapters/control.test.ts`: both verdicts from trivial inputs, the value
  channel matching what you declared, the preparse record matching what the
  harness actually supplied, no declared stage contradicted by a probe, and no
  value written back onto your input while you declare no value exposure.
- `test/constitution/`: no library named above the adapter layer, alphabetical
  ordering by package name, every conformance case carrying its citations, and
  every file tracked.
- `test/report/render.test.ts`: the committed markdown is what the renderer
  produces from the committed measurements.

The two-sided control is worth understanding before passing. The failure it
exists to catch looks like success: an adapter that reads a verdict off a
property that does not exist gets `undefined` forever, and the resulting table
of every input rejected looks plausible while being manufactured by the
accessor. Requiring both verdicts from trivial inputs catches that, and until
your container passes it none of its rows mean anything.

## If you dispute a measurement

The measurement is `report/libraries/<slug>.json`, and it stores your library's
own output for every case. Start there rather than with the rendered markdown:
each cell traces back to a stored `raw` value by case id.

Three things can make a cell inaccurate, and they have different fixes:

- **The adapter drives the library incorrectly.** Fix the adapter. The configuration
  it used is recorded with every result, and a library rejecting everything
  because it was misconfigured is a real failure mode the report should make
  visible.
- **The case is inaccurate.** A conformance case rests on quoted specification text
  with a section anchor, and if the quote does not settle the verdict the case
  claims, that is a defect in the corpus. Open an issue quoting the same text.
- **The specification does not settle it.** Then the case belongs in the
  divergence tier, where implementations are reported as differing and nothing
  is attributed to anyone.

Two things are rejected as fixes: a branch above the adapter layer for your
library, and an adapter that behaves differently for cases it recognises. Both
are detectable in review and one of them is detectable by a test.

## Cost of a new adapter

One container image, built once and cached. A cold `pnpm check:containers` builds
every image in `adapters/`, so adding one adds its build to that cold path and
roughly nothing to a warm run: the corpus is under a hundred cases and each is one HTTP
call to a container already running.
