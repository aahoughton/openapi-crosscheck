# Container protocol changelog

What changed between protocol versions, and what a container has to do about
it. The current shape is in [container-protocol.md](container-protocol.md);
this file is just the history.

## 3

Documents can now declare `in: "querystring"`, the fifth parameter location
OpenAPI 3.2 defines. The message shape did not change: no new fields, none
removed, and `splitting` still has the same four keys.

The bump is here because your dispatch has to answer for a fifth location even
though your parsing does not. Wherever your container switches on `in`, a value
it has never seen can now arrive. If that falls through to a `default` that
raises, the raised error is your container's, and it gets published as though
the library under test produced it.

Every container answers `3` in `describe` and audits that dispatch. Past those
two, what your library needs from you, cheapest first:

1. If your library rejects the document outright, leave it alone. That is a real
   answer and the case records it.
2. If your library accepts the document and has no idea what `querystring` is,
   that is also a real answer. Let it run and report what comes back. This is
   the interesting one: a library that accepts the document and never looks at
   the parameter accepts requests it should reject, and there are cases whose
   whole purpose is to catch exactly that.
3. If your library validates it and your adapter has to hand it something, the
   value is the entire query string. Decode `request.targetBase64`, take
   everything after the first `?`, and pass that string as it stands. Do not
   percent-decode it, do not split it, do not turn `+` into a space. A target
   with no `?` carries no value at all, which is not the same as the empty one
   `/t?` carries: do not let those two land in the same place, and return
   `unsupported` with `cannotRepresentCase` if your input shape cannot hold
   both. Watch for a URL type that decides this for you. Go's `net/url`, for
   one, parses `/t` and `/t?` to the same empty `RawQuery` and keeps the
   difference in `ForceQuery`, so a container reading the parsed URL reports
   the two identically.
4. If your adapter cannot express the case, return `unsupported` with
   `cannotRepresentCase`, as ever. Do not guess.

There is no `preparsed` key for querystring and no `splitting` key for it. The
value is the query string whole, and "everything after the first `?`" has one
answer that every container reaches identically from the target it already
receives. The protocol document says plainly that taking it from the target sits
outside the split ownership rule, so you are within the contract when you do it.
A fifth `splitting` boolean would have asked all of you to declare ownership of
work nobody does.

Two things to watch if you do reach for the target. `/t` and `/t?` are different
requests: the first carries no query string, the second carries an empty one,
and a case turns on the difference. And one operation may declare an
`in: "query"` parameter and an `in: "querystring"` parameter together, which 3.2
makes invalid on purpose; you get the query pairs and the raw target at the same
time, so you can answer it.

## 2

`preparsed.cookies` is a list of `[name, value]` pairs instead of an object.

Cookie crumbs were going into a JSON object, so `Cookie: p=blue; p=black`
reached a container as `{"p": "black"}`. The repeated name is the thing some
cases vary, and the harness was deleting it before anyone saw it. Pairs keep it,
the same way query pairs and wire headers already do.

`preparsed.query` pairs can now carry a `null` value, meaning the pair arrived
with no `=` at all. `?p` and `?p=` were both reaching containers as `["p", ""]`,
so no case could ask whether a library tells them apart. If your library's input
shape has no way to say "name, no value", return `unsupported` with
`cannotRepresentCase`; the three containers here that take preparsed query
pairs all do.

A cookie crumb with no `=` carries a `null` value too, for the same reason. Only
a crumb with nothing in it at all, which is what a trailing semicolon leaves, is
dropped.

Cookie values are no longer trimmed, so whitespace inside or after a value
arrives as sent, and only the space after the `;` separator is dropped.

If your library's request shape can't hold a repeated cookie name, say so:
return `unsupported` with `cannotRepresentCase`. Picking a crumb and carrying on
publishes your library's verdict on a request the case never sent.

## 1

First public version.
