# openapi-core

This adapter measures the PyPI package `openapi-core`.

## Public Entry Point

The container installs `openapi-core` from PyPI. It builds
`OpenAPI.from_dict(document)` and calls `unmarshal_request` with an object that
implements the library's published Request protocol.

The raw path is passed without the query string. Raw query name and value pairs
come from the harness preparse because the Request protocol accepts query
parameters as a mapping. Cookies also come from the harness preparse.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | owned  |
| splitting: path    | owned  |
| splitting: query   | caller |
| splitting: header  | owned  |
| splitting: cookie  | caller |
| style and explode  | owned  |
| content media type | owned  |
| schema validation  | owned  |
| value exposure     | owned  |

## Why These Claims

Routing and path splitting are claimed because `unmarshal_request` receives the
path and resolves the operation and path parameters.

Query splitting is caller-owned because the Request protocol supplies query
parameters as pairs or a mapping.

Header splitting is claimed because the adapter preserves the header names it
received, and the library matches them to declared parameters.

Cookie splitting is caller-owned because the Request protocol supplies cookies
as a mapping.

Style and explode are claimed because `unmarshal_request` converts parameter
values according to their declared serialization.

Content media type is claimed because malformed JSON for a `content` parameter
is rejected.

Schema validation is claimed because validation errors appear in the unmarshal
result.

Value exposure is claimed because `unmarshal_request` returns unmarshalled
parameters.

## Value Channel

Results report values with the `validatedOnly` vantage. A missing parameter name
in a rejected result means that parameter did not pass through validation into
the returned parameter object.
