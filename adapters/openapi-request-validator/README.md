# openapi-request-validator

This adapter measures the npm package `openapi-request-validator`.

## Public Entry Point

The container installs the package from npm at `latest`. It creates
`new OpenAPIRequestValidator({ parameters })` with the operation's parameters
and calls `validateRequest({ params, query, headers })`.

The operation and split request locations come from the harness because this
library validates parameters for an operation rather than accepting a whole HTTP
request target.

## Stage Claims

| stage              | claim  |
| ------------------ | ------ |
| routing            | caller |
| splitting: path    | caller |
| splitting: query   | caller |
| splitting: header  | caller |
| splitting: cookie  | caller |
| style and explode  | caller |
| content media type | caller |
| schema validation  | owned  |
| value exposure     | owned  |

## Why These Claims

Routing is caller-owned because the constructor receives only the operation's
parameter list.

Path, query and header splitting are caller-owned because `validateRequest`
receives location records rather than a raw request target. Every value in
those records is a string, so a query pair the harness supplies with no `=` at
all is answered as a case this shape cannot represent, rather than handed over as
an empty value.

Cookie splitting is caller-owned for a stronger reason: the call takes
`{ params, query, headers }` and there is no cookie position in it, so a cookie
value is never put to the library at all. Nothing here relies on that being
noticed, because every stage a cookie case travels through is caller-owned too
and the runner asks none of them.

Style and explode are caller-owned because the library expects values in the
shape the schema should validate. A comma-joined array value is rejected as a
string rather than split into array members.

Content media type is caller-owned because malformed JSON for a `content`
parameter is passed through as a string.

Schema validation is claimed because `validateRequest` returns errors for
schema violations.

Value exposure is claimed for a write-back channel rather than a return value.
`validateRequest` returns validation errors only. Its schema engine writes
coerced values and schema defaults onto the `{ params, query, headers }` object
it is handed, so a caller reading that object after the call reads values the
library supplied.

## Value Channel

Values come from comparing the object handed to `validateRequest` against the
same object after it returns, at vantage `parsedBeforeValidation`. Only the
positions the library wrote are reported, because echoing untouched input would
report this adapter's own preparse as library output. An input the library left
unchanged reports `unexposed`.

Cookies are never handed to the library, so a cookie position has nothing for it
to write onto and is never read from this channel.
