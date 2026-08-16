# com.atlassian.oai:openapi-request-validator-core

This adapter measures the Maven artifact
`com.atlassian.oai:openapi-request-validator-core`.

## Public Entry Point

The container installs the artifact from Maven Central with `LATEST`. It builds
`OpenApiInteractionValidator` with
`OpenApiInteractionValidator.createForInlineApiSpecification(document).build()`
and calls `validateRequest` with a `SimpleRequest`.

The `SimpleRequest` is built from the raw path. Query name and value pairs come
from the harness preparse because the request builder accepts query parameters
as names and values. Duplicate query names are grouped into the list shape the
builder accepts.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | owned  |
| splitting: path    | owned  |
| splitting: query   | caller |
| splitting: header  | owned  |
| splitting: cookie  | owned  |
| style and explode  | owned  |
| content media type | caller |
| schema validation  | owned  |
| value exposure     | caller |

## Why These Claims

Routing and path extraction are claimed because the validator is given a raw
path and resolves the operation and path parameter.

Query splitting is caller-owned because the public request builder accepts query
parameters through `withQueryParam(name, values)`. Those values are strings, so
a pair the harness supplies with no `=` at all is answered as a case this shape
cannot represent, rather than handed over as an empty value.

Header splitting is claimed because headers are passed to the builder as wire
names and values, and the library matches them to declared header parameters.

Cookie splitting is owned because the library reads cookie parameters out of the
`Cookie` header, and the builder does take headers. `SimpleRequest.Builder`
carries `withAccept`, `withAuthorization`, `withBody`, `withContentType`,
`withHeader` and `withQueryParam`, and no cookie method, so the header is the
route in and the split from header to named cookie is the library's own.

This container previously read the absent cookie method as the library being
unable to take a cookie parameter at all, and refused ten cases as
`cannotRepresentCase`. The library answers them. A missing API on the builder
was evidence about the builder, and it was published as a fact about the
library.

Style and explode are claimed because the builder methods accept string values.
Any conversion from the wire value to the schema value happens inside the
library.

Content media type is caller-owned because malformed JSON in a `content`
parameter is accepted as text instead of being rejected as an unreadable media
representation.

Schema validation is claimed because the validation report changes when a
recovered value violates its schema.

Value exposure is caller-owned because `ValidationReport` exposes `hasErrors`
and messages, with no public channel for deserialized values.

## Value Channel

Results use `unexposed` for accepted and rejected verdicts.
