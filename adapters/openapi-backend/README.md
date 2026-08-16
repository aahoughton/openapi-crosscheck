# openapi-backend

This adapter measures the npm package `openapi-backend`.

## Public Entry Point

The container installs the package from npm at `latest`. It creates
`new OpenAPIBackend({ definition, quick: false, coerceTypes: true })`, calls
`init()`, and validates with `validateRequest`.

The library receives the raw path, raw query string and a header record. Header
folding comes from the harness preparse because the public request shape accepts
headers as a record.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | owned  |
| splitting: path    | owned  |
| splitting: query   | owned  |
| splitting: header  | caller |
| splitting: cookie  | owned  |
| style and explode  | owned  |
| content media type | owned  |
| schema validation  | owned  |
| value exposure     | owned  |

## Why These Claims

Routing and path splitting are claimed because the backend receives the raw path
and matches an operation through its router.

Query splitting is claimed because the backend receives the raw query string.

Header splitting is caller-owned because the public request shape accepts
headers as a record keyed by name, so duplicate wire header lines and casing
have already been reduced before the library sees them.

Cookie splitting is claimed because the backend parses the `Cookie` header from
the header record.

Style and explode are claimed because the router parses request parameters
according to their declared serialization.

Content media type is claimed because content parameters are decoded according
to their declared media type.

Schema validation is claimed because `validateRequest` returns schema errors.

Value exposure is claimed because the adapter reads parsed request values
through the public router path after matching the operation.

## Value Channel

Results report values with the `parsedBeforeValidation` vantage. The parsed
values are read independently of the final verdict, so rejected rows can still
show values.

The library parses the request into path, query, cookie and header bags, so a
parameter declared anywhere else has no bag to be read from. Those are reported
by name in `unreadable`, with the reason, rather than left out of the values,
which would say the library reported nothing for the parameter.

## Options

`coerceTypes` is enabled because typed parameter validation depends on coercion
in this library.
