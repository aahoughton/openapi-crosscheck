# github.com/getkin/kin-openapi

This adapter measures the Go module `github.com/getkin/kin-openapi`.

## Public Entry Point

The container resolves `github.com/getkin/kin-openapi@latest` with Go modules.
It loads the document with `openapi3.NewLoader().LoadFromData`, routes with
`gorillamux.NewRouter`, and validates with
`openapi3filter.ValidateRequest`.

The adapter builds an `http.Request` from the raw target and passes the request
through the public router and validation APIs.

## OpenAPI Versions

3.0, 3.1 and 3.2 are declared. The library's README names all four of 2.0,
3.0, 3.1 and 3.2, with 3.2 marked partial: the Media Type Object
`itemSchema`, the `QUERY` method and `additionalOperations`. Support landed
in v0.141.0, before the version measured here.

## Stage Claims

| stage              | claim |
| ------------------ | ----- |
| routing            | owned |
| splitting: path    | owned |
| splitting: query   | owned |
| splitting: header  | owned |
| splitting: cookie  | owned |
| style and explode  | owned |
| content media type | owned |
| schema validation  | owned |
| value exposure     | owned |

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

Value exposure is claimed for a write-back channel rather than a return value.
`ValidateRequest` and `ValidateParameter` return an error and nothing else, the
parameter decoders are unexported, and the decoded value is a local in
`ValidateParameter` that goes out of scope when it returns. What does reach the
caller is the schema default: for an absent optional parameter
`ValidateParameter` writes the default onto the request it was handed, into
`URL.RawQuery`, the header map or a cookie. A caller reading that request after
the call reads a value the library supplied.

## Value Channel

Values come from comparing the request handed to `ValidateRequest` against the
same request after it returns, at vantage `parsedBeforeValidation`. Only the
positions the library wrote are reported, so only written-back defaults appear.
Every other result reports `unexposed`: the decoded value of a parameter that
was present on the wire is never handed back.

`FindRoute` does return the path parameters, as raw strings before style
deserialization. Those are routing output, and this adapter reads them for the
before and after comparison rather than reporting them as deserialized values.

## Known Boundary

Go's request construction parses the target before validation. The adapter
records this boundary because percent-encoding cases pass through Go's URL
parser before the library validates them.
