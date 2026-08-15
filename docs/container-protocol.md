# Container protocol, version 2

Every library under test runs in its own container and answers this protocol.
The harness speaks only this protocol, so adding a library in any language means
writing a container that answers it, and nothing above the adapter layer changes.

This document is the contract. A container that satisfies it and passes the
conformance suite in `test/container/` produces rows that mean the same thing as
every other library's rows.

## Why the shape is what it is

The harness measures how libraries deserialize request parameters. That makes
the transport between harness and container part of the measurement boundary:
any layer that re-encodes a request target, merges duplicate headers or
canonicalizes casing removes cases the corpus exists to run.

So the two rules the rest of the protocol follows from:

1. **The request target never appears anywhere a transport would parse it.** It
   travels base64-encoded inside a JSON body. It never appears in a URL, a query
   string or a header. A container that reconstructs it must decode the base64
   and hand the resulting bytes to its library without passing them through a
   URL parser of its own first.
2. **Headers travel as an ordered list of pairs.** Duplicate names and
   non-canonical casing are probe dimensions. A JSON object collapses both.

Header names and values travel as plain JSON strings rather than base64. Every
header in the corpus is UTF-8, and JSON carries UTF-8 without loss, so base64
would buy nothing today. The target is base64 anyway, because it is the one
field a transport would parse given the chance, and making that structural is
simpler than relying on every container to remember it. A future probe carrying
bytes that are not valid UTF-8 in a header would need this revisited, and that is a
protocol version bump.

## Transport

HTTP/1.1 over TCP. The container listens on the port given in `PORT`, default
`8080`. It serves two endpoints. Both speak `application/json`.

The harness starts one container per library and reuses it for the whole corpus.
A container holds no state between calls: the same request must produce the same
response whenever it is sent.

## `GET /describe`

Called once, before any case. Answers what the library can be asked.

```json
{
  "protocol": 2,
  "library": "@oaverify/core",
  "libraryVersion": "7.0.0",
  "librarySource": "https://github.com/oaverify/oaverify",
  "libraryResolution": { "kind": "registry", "specifier": "latest" },
  "capabilities": {
    "stages": {
      "routing": true,
      "splitting": { "cookie": false, "header": true, "path": true, "query": true },
      "styleDeserialization": true,
      "contentDeserialization": true,
      "schemaValidation": true,
      "valueExposure": true
    },
    "oasVersions": { "3.0": true, "3.1": true, "3.2": false }
  },
  "configuration": {
    "id": "fetch-request-return-values",
    "description": "how this library was constructed and driven, and any known limitation",
    "options": {}
  }
}
```

`stages` is what the library does for itself. Splitting is per location because
a library can extract path parameters from a raw target and still refuse a query
string. Every location must be answered: a missing one would default to owned
and silently attribute a harness split to the library.

`styleDeserialization` and `contentDeserialization` are siblings rather than a
sequence, because the specification defines exactly two ways a parameter's
serialization is specified and requires each parameter to use one. A parameter
declaring `content` has no `style` and no `explode`; a parameter declaring
`schema` has no media type. A library owning one has said nothing about the
other, and a case travels through whichever its own declaration names.

`oasVersions` declares which OpenAPI versions the library accepts documents of.
Every version the protocol knows must be answered explicitly, the same rule as
`splitting`: a missing key would default silently, and "does not support 3.0"
and "nobody answered for 3.0" are different facts. A declaration names a minor
line, so `"3.1": true` claims 3.1.x documents; the corpus's citations pin exact
patch revisions where exactness matters. The harness asks a library only the
cases whose version it declares, publishes the rest as `oasVersionNotDeclared`,
and probes every version anyway with an ordinary document of that version, one
valid request and one value outside the schema. What the probe saw is published
beside the declaration in `capabilities.md`. Like every probe it demonstrates
and never refutes, so a declared version no probe showed is an unbacked claim
rather than a failure, and a disclaimed version that answered is printed for a
reader to judge.

Both are declarations, and `test/adapters/control.test.ts` drives every declared
stage two-sidedly against the container that declared it. A stage a container
disclaims is probed anyway, and what the probe saw is published in
`report/capabilities.md` next to the disclaim.

`libraryVersion` is read from the installed package at runtime rather than
written into the image by hand. Current registry resolution and repeatability
are in tension, and the recorded resolution says how the package was requested.
The image digest identifies the built image that answered, and the harness
stores it alongside.

`librarySource` is where a reader can go and look at the library, as an
`https://` URL, or `null`. It is required and nullable rather than optional: an
absent field defaults silently, and a container with no URL to give should say
so.

Where the URL comes from is the container's business, like everything else about
how a container is built. Writing it down beside the library name is the
expected way and is what the containers here do. Resolving it from the installed
package's metadata is also fine, and is the only way that keeps up on its own
when a project moves, at the cost of a different lookup in every ecosystem: npm
spells `repository` three ways including git remotes, Python labels Project-URL
entries by hand, a Go module path is already a host and a repository, and Maven
puts `scm` on a POM that may be the artifact's parent rather than the artifact.

Unlike `libraryVersion`, this is not measured and nothing is scored on it. It is
a claim by whoever wrote the container: nothing resolves it, nothing checks that
the source is what was built, and the reports say so where they show it. A URL
that is not `https://` is refused by the protocol suite rather than rewritten,
because turning an `ssh://` or `git@` remote into a web address is guessing at a
host's layout.

`libraryResolution` says how the library got into the image: `registry` for a
public resolution, `local` for a path, an archive, a link or a checkout, with
the manifest's own specifier beside it where there is one.

Derive this one, which is the opposite of the rule for `librarySource` and for
the reason that rule does not reach. `libraryVersion` comes from the installed
package, and an unreleased tree carries the last released version there, so a
run measuring a working tree two commits ahead of 7.0.0 records 7.0.0. That is
least useful for a library author grading a fix before it ships. A hand-written
`registry` would survive being copied: someone forks a container, points the
manifest at a tarball, and the inherited claim says the run measured a release.
Read the specifier from the manifest, which is the file that person edited.

Which spellings mean local is the container's to decide, because they belong to
the ecosystem: npm has `file:`, `link:` and `portal:`, Python has paths,
archives and `git+`, Go has a `replace` directive the build info carries, and
Maven has `systemPath` and a `file://` repository.

`configuration` says how the library was constructed and driven. `id` is a
short stable handle, and the reports print it beside every result. `description`
writes the configuration out in words: which published call the adapter makes,
with what options, which locations arrive already split, and any known
limitation. `options` carries the values the adapter passed, as data. Every
result is published with the configuration that produced it, because
configuration is a confound: a library rejecting everything may be
misconfigured rather than strict, and two measurements of one library under
different configurations are simply two measurements.

## `POST /run`

Called once per case.

```json
{
  "protocol": 2,
  "caseId": "path-matrix-scalar-canonical-oas31",
  "document": { "openapi": "3.1.0", "...": "the case's document, verbatim" },
  "request": {
    "method": "GET",
    "targetBase64": "L3QvO3A9Ymx1ZQ==",
    "headers": [["Host", "harness.invalid"]]
  },
  "preparsed": null
}
```

`preparsed` carries the split the harness performed, **per location**, and a
location is `null` when the container declared that its library recovers those
values itself:

```json
"preparsed": {
  "params": null,
  "query": [["p", "blue"], ["p", "black"]],
  "headers": null,
  "cookies": [["p", "blue"], ["p", "black"]]
}
```

A container must not read a location it declared it owns. Doing so measures the
harness's splitting while the declaration says otherwise, and nothing in the
protocol could detect it.

Query preparse is raw and ordered. The harness splits the request target at the
first `?`, then splits the query string on `&` and the first `=` in each pair.
It does not percent-decode, does not turn `+` into space, does not apply a
style, and does not collapse duplicate names. A pair that carried no `=` has a
`null` value, because `?p` and `?p=` are different requests and a container
decides for itself whether its library's input shape can tell them apart. This keeps percent encoding and duplicate-name handling attributable to
the library or to the adapter boundary that its public API requires.

Cookie preparse is raw and ordered for the same reasons. The harness splits
each `Cookie` header on `;`, drops the optional space that follows the
semicolon, and splits each crumb at its first `=`. Nothing else is trimmed, so
whitespace inside or after a value arrives as it was sent, and a repeated cookie
name arrives twice in the order it was sent. A crumb carrying no `=` has a
`null` value, the same as a query pair that carried none; a crumb with nothing
in it at all, which is what a trailing semicolon leaves, names no cookie and is
dropped. Cookie pairs are a list rather than an object because a repeated name
is a probe dimension the corpus varies, and an object holds one value per key.

Some libraries expose only a framework-shaped request API, such as a decoded or
mapped query object. An adapter for such a library may convert the raw pairs
into that public input shape, but that work is adapter-side boundary adaptation.
The adapter configuration must say what it did, and if the public API cannot
represent the raw input without deleting a probe dimension, the adapter must
return `unsupported` with `adapterLimitation` rather than inventing an answer.

The record is per location because ownership is per location. openapi-core
recovers its own path parameters and refuses a query string, and a single
record covering every location cannot describe it: whichever way it answered,
some of its results would carry a claim about locations the harness never
touched, and a reader checking whether a path result was really the library's
would have discounted it.

The split stays harness-side for the locations it covers: a container splitting
for itself where it declared otherwise produces results that are not comparable
with any other container's.

### The response

```json
{
  "protocol": 2,
  "outcome": "accepted",
  "deserialized": {
    "kind": "observed",
    "vantage": "validatedOnly",
    "value": { "p": "blue" },
    "nativeTypes": { "p": "string" }
  },
  "inputMutation": {
    "kind": "none",
    "detail": "the params, query and headers object handed to validateRequest, unchanged"
  },
  "raw": { "...": "whatever the library returned, serialized and otherwise unedited" }
}
```

`outcome` is one of:

| outcome        | meaning                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `accepted`     | the library accepted the request                                         |
| `rejected`     | the library rejected it                                                  |
| `unsupported`  | the case could not be put to this library; carries `reason` and `detail` |
| `libraryError` | the library raised instead of answering; attributable to it              |
| `adapterError` | the container's own code broke; never a library failure                  |

`libraryError` is not a rejection. A rejection is a verdict the library reached;
a raise is the absence of one, and an application driving the library would have
seen an exception rather than a refusal. Folding it into `rejected` would credit
a library for a verdict it never gave, and folding it into `adapterError` would
attribute the library's exception to the adapter.

`unsupported` carries a `reason` from a closed set: `cannotRepresentCase`,
`libraryInitUnsupported`, or `adapterLimitation`. The fourth member,
`stageNotOwned`, is issued by the harness and never by a container.

### `deserialized`

Three constructors, because "this library never exposes values", "it could have
and did not reach that point" and "it exposed these" are three different facts
and a report that renders them alike loses information.

```json
{ "kind": "observed", "vantage": "...", "value": {}, "nativeTypes": {} }
{ "kind": "unexposed", "reason": "no published call returns deserialized values" }
{ "kind": "notReached", "reason": "no operation matched, so nothing was parsed" }
```

`value` is keyed by the parameter names the case declares, read from the
location each was declared in. Reporting every key the request happened to carry
would report values the case never asked about.

### `inputMutation`

The other way a library can hand values back, and the one no other field shows.

`deserialized` covers what a published call returns. A library can also write
deserialized values onto the request object its caller passed it, and a caller
reading that object after the call is reading a real value channel. A library
doing that while declaring `valueExposure: false` has an exposure it did not
declare, and every value cell for it understates what a caller can get.

Only the container can answer this. It is the side that holds the object it
handed over, and what comparing two of them means is a question about its own
language. So it takes a snapshot before the call, compares after, and reports:

```json
{ "kind": "none", "detail": "<what was compared>, unchanged" }
{ "kind": "observed", "detail": "<what was compared>; <what changed>" }
{ "kind": "notCompared", "detail": "<why nothing could be compared>" }
```

`detail` is required whichever kind is reported, and carries the scope. A `none`
is read against what it actually compared, so a container that hands its library
a request built from four fields says which four. A container that cannot look
at all reports `notCompared` and says why: driving a library over a socket, or
through an API that builds its own request object, leaves nothing this side
holds. That is a gap in the measurement rather than a clean result, and it is
published as one in `capabilities.md`.

This is the third constructible contradiction, after the splitting one and the
`unexposed` one. Like both of those it fires only positively: `none` is not
evidence for a declaration and `notCompared` is not evidence for anything.
Only `observed` beside `valueExposure: false` is a contradiction, and it is a
contradiction between two fields with nothing inferred in between.

### `vantage`

From what point in the library's own processing the values were read. Closed
set. Without it an absent parameter name means three different things across the
roster and one column renders all three the same.

| vantage                  | an absent name means                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `handedToHandler`        | the handler never ran                                                                     |
| `parsedBeforeValidation` | nothing; values are reported whether or not the library then rejected, and may be partial |
| `validatedOnly`          | that parameter failed its schema and was withheld                                         |

A container reporting a vantage outside this set fails the conformance suite. It
is not coerced to the nearest member: extending the set is a deliberate change
with a stated reason, which is what keeps it from becoming a junk drawer.

### `nativeTypes`

The language-level type of each reported value, as the container names it,
keyed by the same declared parameter names as `value`.

This exists because JSON has one number type and languages do not. Python's
`openapi-core` returns `int 1` for `type: integer` and `float 1.0` for
`type: number`. `@oaverify/core` returns `1` for both, because JavaScript has one
number type. Both facts are true and they are different, and plain JSON renders
them identically.

Two rules govern it, and the second matters more than the first:

1. It is **reported**. The matrix displays it, so int against float is visible.
2. It is **never scored**. Scoring compares values by JSON equivalence. A
   library is never failed for its language's number model, because that would
   fail libraries for the language they are written in rather than for what they
   did, and no library in this repository is privileged over another.

The strings are the container's own naming and are passed through unchanged. A
Python container saying `list[int]` and a JavaScript one saying `Array<number>`
are both describing themselves accurately. They are displayed, never compared.

## Protocol version

`protocol` is `2` on every message in both directions. The harness refuses a
container answering a different number rather than guessing at compatibility. A
change that would alter what a cell means is a version bump.

[protocol-changelog.md](protocol-changelog.md) says what changed in each
version and what a container written against an older one has to do.

## Adding a library

Write a container that answers `/describe` and `/run`, put it in a directory,
and name that directory when you measure. There is no roster to join: what gets
measured is what the command names, so a container kept outside this repository
runs on exactly the terms of the ones inside it.

[adding-an-adapter.md](adding-an-adapter.md) is the walkthrough, including what
the gate holds an adapter to and how to dispute a measurement.
