# league/openapi-psr7-validator

This adapter measures the Packagist package `league/openapi-psr7-validator`.

## Public Entry Point

The container installs `league/openapi-psr7-validator` with Composer. It builds
`ValidatorBuilder::fromJson($document)`, takes `getRequestValidator()`, and
calls `validate()` with a PSR-7 request built from the raw target.

The library offers two request validators. This adapter uses the plain
`RequestInterface` one rather than the server request one, because the plain one
reads the `Cookie` header for itself where the server one takes an already split
cookie array from its caller. Every location therefore stays the library's, and
the harness supplies nothing.

A verdict arrives as a return or a raise: `validate()` answers with an
`OperationAddress` or throws a `ValidationFailed`. Routing failures are
`ValidationFailed` too, so an unmatched path is a rejection rather than a
separate outcome. Anything else raised is reported as a library error.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | owned  |
| splitting: path    | owned  |
| splitting: query   | owned  |
| splitting: header  | owned  |
| splitting: cookie  | owned  |
| style and explode  | owned  |
| content media type | owned  |
| schema validation  | owned  |
| value exposure     | caller |

## Why These Claims

Routing and path splitting are claimed because `validate()` resolves the
operation from the request URI and returns the path template it matched, and
raises when the document declares no such operation.

Query splitting is claimed because the validator reads the query string from the
request URI.

Header splitting is claimed because the adapter adds the header pairs it
received in order, and the library matches them to declared parameters itself.

Cookie splitting is claimed because the plain request validator parses the
`Cookie` header rather than receiving a cookie array.

Style and explode are claimed because parameter values are deserialized
according to their declared serialization before their schemas are checked.

Content media type is claimed because a `content` parameter carrying malformed
JSON is rejected.

Schema validation is claimed because schema violations are raised as validation
failures naming the parameter.

Value exposure is caller-owned because `validate()` answers with an
`OperationAddress`, which names the matched operation and carries no parameter
values. The deserializer that converts a styled parameter is not reachable from
the published validation call.

## Value Channel

Results use `unexposed` for accepted and rejected verdicts.

## Known Boundary

PSR-7 carries a URI object rather than a request target, so the target is parsed
into one before the library sees it. Percent-encoded sequences reach the
validator unchanged, and percent-encoding cases measure that parser as well as
the library. A target the URI type refuses is reported as `unsupported` with
`cannotRepresentCase` rather than being reshaped into one it accepts.
