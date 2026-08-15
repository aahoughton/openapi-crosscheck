# express-openapi-validator

This adapter measures the npm package `express-openapi-validator`.

## Public Entry Point

The container installs the package from npm at `latest`. It mounts
`OpenApiValidator.middleware({ apiSpec, validateRequests: true })` on an
Express application. Every declared path template gets a handler, and the
adapter sends the raw HTTP request to the mounted app.

The success handler echoes `req.params`, `req.query` and `req.headers`. The
error handler echoes the same request fields alongside the validation error.

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

Routing is claimed because the middleware is mounted before the handlers and
selects the operation from the incoming HTTP request.

Path, query and header splitting are claimed because the adapter sends the raw
HTTP request to Express and the middleware validates what the application sees.

Cookie splitting is caller-owned in this configuration because Express does not
populate `req.cookies` without a cookie parser. Adding such a parser would make
the surrounding app split cookies before the validator sees them.

Style and explode are claimed because the middleware receives raw request
locations and writes parsed values onto the request object.

Content media type is claimed because malformed JSON for a `content` parameter
is rejected by the middleware.

Schema validation is claimed because the middleware rejects values that violate
their schemas.

Value exposure is claimed because accepted requests reach the handler with
coerced values, and rejected requests reach the error handler with whatever the
middleware had already written onto the request.

## Value Channel

Accepted results report values with the `handedToHandler` vantage. Rejected
results report values with the `parsedBeforeValidation` vantage, and those
values can be partial.
