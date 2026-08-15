# Container protocol changelog

What changed between protocol versions, and what a container has to do about
it. The current shape is in [container-protocol.md](container-protocol.md);
this file is just the history.

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
