# @oaverify/core

This adapter measures the npm package `@oaverify/core`.

## Public Entry Point

The container installs the package from npm at `latest`. It creates a validator
with `createValidator(document, { returnValues: true })` and calls
`validateRequest`.

The request path is passed with its query string attached. Headers are passed as
the library's request shape spells them, preserving wire casing and collecting
repeated names as arrays. Cookies come from the harness preparse, which supplies
them as pairs.

## OpenAPI Versions

3.0, 3.1 and 3.2 are declared. The library's Versions table gives 3.2.x the
2020-12 dialect, the same as 3.1 plus the `QUERY` method, and the installed
7.0.0 classifies a 3.2 document into that bucket.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | owned  |
| splitting: path    | owned  |
| splitting: query   | owned  |
| splitting: header  | owned  |
| splitting: cookie  | caller |
| style and explode  | owned  |
| content media type | owned  |
| schema validation  | owned  |
| value exposure     | owned  |

## Why These Claims

Routing and path splitting are claimed because `validateRequest` receives the
path and resolves the matching operation and path parameters.

Query splitting is claimed because the path includes the query string, and the
library reads the query out of that path when the request omits a separate
query field.

Header splitting is claimed because the adapter preserves header casing and
repeat structure, leaving name matching to the library.

Cookie splitting is caller-owned because this request shape accepts cookies as a
mapping. That mapping holds one string per name, unlike the header and query
fields beside it, so neither a case sending the same cookie name twice nor one
sending a crumb with no `=` can be handed over as sent, and both are answered
`unsupported` with `cannotRepresentCase`, the reason that names the library's shape rather than this container's.

Style and explode are claimed because the library converts raw parameter values
according to their declared serialization.

Content media type is claimed because content parameters are decoded according
to their declared media type.

Schema validation is claimed because invalid deserialized values are rejected.

Value exposure is claimed because `returnValues: true` returns the values that
reached the value channel.

## Value Channel

Results report values with the `validatedOnly` vantage. A missing parameter name
in a rejected result means that parameter did not pass through validation into
the returned value object.
