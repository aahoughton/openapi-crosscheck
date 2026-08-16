# openapi_first

This adapter measures the RubyGems package `openapi_first`.

## Public Entry Point

The container installs `openapi_first` with Bundler. It parses the document with
`OpenapiFirst.parse`, and validates with `validate_request` given a
`Rack::Request`.

The Rack environment is built from the raw target: the path goes in as
`PATH_INFO` undecoded, and everything after the first `?` as `QUERY_STRING`.
Header names are put in under Rack's own convention, which upcases them and
joins duplicates with a comma, because that environment is the only request
shape the public call accepts.

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

Routing and path splitting are claimed because `validate_request` matches the
path template itself and reports an undefined path as a failure.

Query splitting is claimed because the library reads and splits `QUERY_STRING`.

Header and cookie splitting are claimed because the library reads both out of
the Rack environment, matching declared parameters to header names and parsing
the `Cookie` header itself.

Style and explode are claimed because parameter values are deserialized
according to their declared serialization before their schemas are checked.

Content media type is claimed because a `content` parameter is deserialized as
its declared media type and reported against the schema of the parsed value.

Schema validation is claimed because a schema violation produces a failure
naming the parameter that failed.

Value exposure is claimed because a validated request answers with the parsed
parameters for each location.

## Value Channel

Results report values with the `parsedBeforeValidation` vantage. Parsed
parameters are available whether or not the request was then rejected, so a
value on a rejected row is what the library had parsed at the point it refused
rather than something it accepted. A rejection reached before any parameter was
parsed reports `notReached`.

The library parses the request into path, query, header and cookie hashes, so a
parameter declared anywhere else has no hash to be read from. Those are reported
by name in `unreadable`, with the reason, rather than left out of the values,
which would say the library reported nothing for the parameter.

## Known Boundary

Rack's environment has one slot per header name, upcased, so header casing is
not preserved and duplicate names arrive comma-joined. That is the shape the
public call takes, and cases varying header casing or repeating a header name
measure it as well as the library.
