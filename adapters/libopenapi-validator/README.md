# github.com/pb33f/libopenapi-validator

This adapter measures the Go module `github.com/pb33f/libopenapi-validator`.

## Public Entry Point

The container resolves `github.com/pb33f/libopenapi-validator@latest` with Go
modules. It parses the document with `libopenapi.NewDocument`, builds a
validator with `validator.NewValidator`, and validates with
`ValidateHttpRequest`.

The adapter builds an `http.Request` from the raw target and passes it to the
one public validation call. Routing is part of that call rather than a separate
step: an unmatched path comes back as a validation error carrying the type
`path`.

## OpenAPI Versions

3.0, 3.1 and 3.2 are declared. The library's README says document validation
is explicitly covered for all three, and 3.2 support arrived in v0.14.0, the
version measured here.

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

Routing and path splitting are claimed because `ValidateHttpRequest` resolves
the path item and the path parameters from the request itself, and reports an
unmatched path as a `path` validation error.

Query, header and cookie splitting are claimed because the validator receives an
`http.Request` and reads the query string, the headers and the cookies through
Go's request model.

Style and explode are claimed because parameter values are decoded according to
their declared serialization before their schemas are checked.

Content media type is claimed because a `content` parameter carrying malformed
JSON is rejected as invalid JSON, separately from a schema failure on the parsed
value.

Schema validation is claimed because validation errors are returned for schema
violations.

Value exposure is caller-owned because `ValidateHttpRequest` answers with a
boolean and a list of validation errors. The helpers that decode a styled
parameter live in internal packages, so no published call hands the values back.

## Value Channel

Results use `unexposed` for accepted and rejected verdicts.

## Known Boundary

Go's request construction parses the target before validation. The adapter
records this boundary because percent-encoding cases pass through Go's URL
parser before the library validates them.
