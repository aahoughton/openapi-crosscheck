# github.com/getkin/kin-openapi

This adapter measures the Go module `github.com/getkin/kin-openapi`.

## Public Entry Point

The container resolves `github.com/getkin/kin-openapi@latest` with Go modules.
It loads the document with `openapi3.NewLoader().LoadFromData`, routes with
`gorillamux.NewRouter`, and validates with
`openapi3filter.ValidateRequest`.

The adapter builds an `http.Request` from the raw target and passes the request
through the public router and validation APIs.

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

Routing and path splitting are claimed because `FindRoute` resolves the
operation and path parameters from the request.

Query and header splitting are claimed because the validator receives an
`http.Request` and reads the query string and headers through Go's request
model.

Cookie splitting is claimed because the library reads cookies from the request
rather than receiving a cookie map from the caller.

Style and explode are claimed because `ValidateRequest` decodes parameter
values before checking their schemas.

Content media type is claimed because malformed JSON for a `content` parameter
is rejected.

Schema validation is claimed because `ValidateRequest` returns validation errors
for schema violations.

Value exposure is caller-owned because the public validation path returns errors
only. The parameter decoding helper is unexported, and the validation input does
not expose decoded parameter values.

## Value Channel

Results use `unexposed` for accepted and rejected verdicts.

## Known Boundary

Go's request construction parses the target before validation. The adapter
records this boundary because percent-encoding cases pass through Go's URL
parser before the library validates them.
