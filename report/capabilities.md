# Capabilities

What each library can be asked, which is a different question from what it
answers. Every entry here is a declaration its adapter made, and every one was
probed in this run: the tables below publish what each probe saw, including
where a declaration is unbacked and where a disclaimed stage was exercised
anyway. The vantage column is read back from results rather than declared at
all.

The probes do not prove every declaration, and the section below says which
ones they can settle and which they cannot.

| library | accepts a request target | value vantages observed | owns routing |
| --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | no | none | yes |
| `express-openapi-validator` | yes | `handed to the handler`; `parsed before validation` | yes |
| `github.com/getkin/kin-openapi` | yes | `parsed before validation` | yes |
| `github.com/pb33f/libopenapi-validator` | yes | none | yes |
| `league/openapi-psr7-validator` | yes | none | yes |
| `@oaverify/core` | yes | `validated only, so an absent name failed its schema` | yes |
| `openapi-backend` | yes | `parsed before validation` | yes |
| `openapi-core` | no | `validated only, so an absent name failed its schema` | yes |
| `openapi-request-validator` | no | `parsed before validation` | no |
| `openapi_first` | yes | `parsed before validation` | yes |

Every value cell says from what point in the library's own processing the
values were read, because an absent parameter name does not mean the same
thing across the roster:

- `handed to the handler`: what the application was given. A name is absent
  when the handler never ran.
- `parsed before validation`: what the library parsed, reported whether or not
  it then rejected. On a rejection these can be partial.
- `validated only, so an absent name failed its schema`: only the parameters
  that passed. An empty cell here is a withheld value, not an empty parse.

Comparing a value across two libraries means comparing the vantages too. A
library reporting a coerced value alongside its own rejection and a library
withholding it are stating different facts, and neither is a failure.

A library that does not accept a request target is never asked a
wire-deserialization question. The harness would have to split the target for
it, and the verdict would then describe the harness's splitting rather than the
library. Those cells read `not asked (noWireInputApi)`.

## Value exposure, case by case

What each library handed back across the whole corpus, with the denominator.
A library with no exposure API and a library that exposed nothing here are
different facts, and a column of blanks renders them the same.

`reached a verdict` is the denominator: cases where the library decided, so
there was a point at which values could have been reported. `observed`,
`unexposed` and `not reached` partition it. `never asked` and `raised` sit
outside it, because a case the library was never given and a case it threw on
never reached that point at all.

| library | reached a verdict | observed | unexposed | not reached | never asked | raised |
| --- | --- | --- | --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | 140 | 0 | 140 | 0 | 30 | 0 |
| `express-openapi-validator` | 162 | 152 | 10 | 0 | 2 | 6 |
| `github.com/getkin/kin-openapi` | 162 | 2 | 160 | 0 | 8 | 0 |
| `github.com/pb33f/libopenapi-validator` | 170 | 0 | 170 | 0 | 0 | 0 |
| `league/openapi-psr7-validator` | 162 | 0 | 162 | 0 | 0 | 8 |
| `@oaverify/core` | 164 | 164 | 0 | 0 | 6 | 0 |
| `openapi-backend` | 161 | 161 | 0 | 0 | 4 | 5 |
| `openapi-core` | 155 | 155 | 0 | 0 | 12 | 3 |
| `openapi-request-validator` | 18 | 2 | 16 | 0 | 152 | 0 |
| `openapi_first` | 170 | 170 | 0 | 0 | 0 | 0 |

Split by the verdict the values were reported alongside, because a library that
exposes what it parsed even for a request it rejected is stating something a
library that withholds on rejection is not. Both are legitimate and neither is
a failure.

| library | verdict | observed | unexposed | not reached | vantages |
| --- | --- | --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | accepted | 0 | 70 | 0 | none |
| `com.atlassian.oai:openapi-request-validator-core` | rejected | 0 | 70 | 0 | none |
| `express-openapi-validator` | accepted | 90 | 10 | 0 | handed to the handler |
| `express-openapi-validator` | rejected | 62 | 0 | 0 | parsed before validation |
| `github.com/getkin/kin-openapi` | accepted | 2 | 118 | 0 | parsed before validation |
| `github.com/getkin/kin-openapi` | rejected | 0 | 42 | 0 | none |
| `github.com/pb33f/libopenapi-validator` | accepted | 0 | 150 | 0 | none |
| `github.com/pb33f/libopenapi-validator` | rejected | 0 | 20 | 0 | none |
| `league/openapi-psr7-validator` | accepted | 0 | 86 | 0 | none |
| `league/openapi-psr7-validator` | rejected | 0 | 76 | 0 | none |
| `@oaverify/core` | accepted | 136 | 0 | 0 | validated only, so an absent name failed its schema |
| `@oaverify/core` | rejected | 28 | 0 | 0 | validated only, so an absent name failed its schema |
| `openapi-backend` | accepted | 76 | 0 | 0 | parsed before validation |
| `openapi-backend` | rejected | 85 | 0 | 0 | parsed before validation |
| `openapi-core` | accepted | 87 | 0 | 0 | validated only, so an absent name failed its schema |
| `openapi-core` | rejected | 68 | 0 | 0 | validated only, so an absent name failed its schema |
| `openapi-request-validator` | accepted | 2 | 4 | 0 | parsed before validation |
| `openapi-request-validator` | rejected | 0 | 12 | 0 | none |
| `openapi_first` | accepted | 140 | 0 | 0 | parsed before validation |
| `openapi_first` | rejected | 30 | 0 | 0 | parsed before validation |

## Values written back onto the caller's input

A published call is one way a library hands values back. Writing them onto the
request object its caller passed is another, and a caller reading that object
afterwards is reading a real value channel. Nothing in the table above can see
it, so each container compares what it handed over against what came back and
reports the answer with every case.

`wrote back` is the finding. `unchanged` is the container having compared and
found nothing, which is a fact about the library. `not compared` is the
container unable to look, which is a fact about the container: it is a gap in
the measurement rather than a clean result, and it is published as one.

A library that writes back while declaring no value exposure is contradicting
itself, and the gate fails on that. A library that writes back and declares
exposure is doing two things at once, which is worth knowing and is not a
failure.

| library | declares exposure | wrote back | unchanged | not compared |
| --- | --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | no | 0 | 140 | 0 |
| `express-openapi-validator` | yes | 0 | 0 | 162 |
| `github.com/getkin/kin-openapi` | yes | 2 | 160 | 0 |
| `github.com/pb33f/libopenapi-validator` | no | 0 | 170 | 0 |
| `league/openapi-psr7-validator` | no | 0 | 162 | 0 |
| `@oaverify/core` | yes | 0 | 164 | 0 |
| `openapi-backend` | yes | 0 | 161 | 0 |
| `openapi-core` | yes | 60 | 95 | 0 |
| `openapi-request-validator` | yes | 2 | 16 | 0 |
| `openapi_first` | yes | 0 | 170 | 0 |

What was compared, and what changed where something did, is on every answer in
`libraries/<name>.json` under `inputMutation`. A count here with no scope
beside it would be a number nobody could weigh.

## What the declarations were probed with

Every stage above is declared by an adapter, and every declaration is probed.
Each probe is two-sided: one input a library owning that stage accepts and one it
rejects, differing only in the dimension that stage governs. A library that
ignores what it does not understand accepts both, so accepting the valid side
alone shows nothing; the pair is what carries the evidence.

The probes are the harness checking its own inputs. They carry no citation and
no tier, they answer no question about the specification, and they are not in
`corpus.json`. Both sides of every one are stored with the library's own output
in `libraries/<slug>.json` under `capabilityEvidence`.

A splitting claim is evidenced only by the variant that withholds the location
under probe while supplying every other location as usual. Run on the input a
library normally receives, a splitting probe would be measuring the harness.
The `asDeclared` variant is the control: it shows both sides are answerable at
the boundary the library accepts, so a failure in the other variant reads as
`did not recover that location` rather than `could not answer this at all`.

A probe demonstrates ownership and almost never refutes it, and the gate is
built on that asymmetry. Ownership is who does the work: a library owns a
deserialization stage when it converts the raw value itself rather than
requiring its caller to. Whether it converts it correctly is the question
the matrix files ask. A library that reads a comma-joined array as JSON fails
every style probe here while plainly doing the conversion itself, so a probe
that showed nothing cannot be read as the stage being absent.

So a declared stage no probe showed is published as an unbacked claim, with the
probes that showed nothing named, and it does not fail the gate. Reading absent
evidence as absent capability would let any library move its attributable
failures into `not asked` by disclaiming the stage.

Three contradictions can be built, and those do fail the gate. A splitting
claim is contradicted when the library answers with the location supplied and
not without it, because supplying a split is upstream work the harness may do
and the counterfactual is therefore constructible. An exposure claim is
contradicted by `unexposed` in the same result. A disclaimed exposure is
contradicted by a write-back in the section above, which is two fields of one
answer disagreeing. Every other stage would need the harness to deserialize on
the library's behalf to build the counterfactual, which it must never do.

A stage a library disclaims that a probe exercised anyway is printed for a
reader to judge rather than treated as a correction.

### What stands behind each declared stage

A declaration rests on the probes of that stage, and on nothing else. Letting a
conformance pass stand in for a probe was considered and dropped: the only pass
that would evidence a stage is one whose expected values matched, a library that
exposes no values can never produce one whatever it does, and no declaration in
this roster rested on it. It decided nothing while tying a capability claim to a
conformance score.

Probes that did not show a stage stay in the row beside whatever did. A stage
demonstrated by one probe while another probe of it showed nothing is partial
support, and printing only the support would turn that into a checkbox.

| library | stage | declared | shown by | probes that did not show it |
| --- | --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | routing | owned | `routing-method` | none |
| `com.atlassian.oai:openapi-request-validator-core` | splitting: cookie | caller | nothing, which is what a disclaim predicts | `splitting-cookie-withoutProbedLocation` (consistent with the disclaim) |
| `com.atlassian.oai:openapi-request-validator-core` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `com.atlassian.oai:openapi-request-validator-core` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `com.atlassian.oai:openapi-request-validator-core` | splitting: query | caller | nothing, which is what a disclaim predicts | `splitting-query-withoutProbedLocation` (consistent with the disclaim) |
| `com.atlassian.oai:openapi-request-validator-core` | styleDeserialization | owned | nothing this run could show, so the claim is unbacked here | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` |
| `com.atlassian.oai:openapi-request-validator-core` | contentDeserialization | caller | nothing, which is what a disclaim predicts | `content-deserialization-json-object` (consistent with the disclaim) |
| `com.atlassian.oai:openapi-request-validator-core` | schemaValidation | owned | `schema-validation-enum` | none |
| `com.atlassian.oai:openapi-request-validator-core` | valueExposure | caller | nothing, which is what a disclaim predicts | `value-exposure-accepted`, `value-exposure-write-back` (consistent with the disclaim) |
| `express-openapi-validator` | routing | owned | `routing-method` | none |
| `express-openapi-validator` | splitting: cookie | caller | nothing, which is what a disclaim predicts | `splitting-cookie-withoutProbedLocation` (consistent with the disclaim) |
| `express-openapi-validator` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `express-openapi-validator` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `express-openapi-validator` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `express-openapi-validator` | styleDeserialization | owned | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` | none |
| `express-openapi-validator` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `express-openapi-validator` | schemaValidation | owned | `schema-validation-enum` | none |
| `express-openapi-validator` | valueExposure | owned | `value-exposure-accepted`, `value-exposure-write-back` | none |
| `github.com/getkin/kin-openapi` | routing | owned | `routing-method` | none |
| `github.com/getkin/kin-openapi` | splitting: cookie | owned | `splitting-cookie-withoutProbedLocation` | none |
| `github.com/getkin/kin-openapi` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `github.com/getkin/kin-openapi` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `github.com/getkin/kin-openapi` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `github.com/getkin/kin-openapi` | styleDeserialization | owned | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` | none |
| `github.com/getkin/kin-openapi` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `github.com/getkin/kin-openapi` | schemaValidation | owned | `schema-validation-enum` | none |
| `github.com/getkin/kin-openapi` | valueExposure | owned | `value-exposure-write-back` | `value-exposure-accepted` |
| `github.com/pb33f/libopenapi-validator` | routing | owned | `routing-method` | none |
| `github.com/pb33f/libopenapi-validator` | splitting: cookie | owned | `splitting-cookie-withoutProbedLocation` | none |
| `github.com/pb33f/libopenapi-validator` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `github.com/pb33f/libopenapi-validator` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `github.com/pb33f/libopenapi-validator` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `github.com/pb33f/libopenapi-validator` | styleDeserialization | owned | `style-deserialization-array-query` | `style-deserialization-array-header`, `style-deserialization-array-path` |
| `github.com/pb33f/libopenapi-validator` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `github.com/pb33f/libopenapi-validator` | schemaValidation | owned | `schema-validation-enum` | none |
| `github.com/pb33f/libopenapi-validator` | valueExposure | caller | nothing, which is what a disclaim predicts | `value-exposure-accepted`, `value-exposure-write-back` (consistent with the disclaim) |
| `league/openapi-psr7-validator` | routing | owned | `routing-method` | none |
| `league/openapi-psr7-validator` | splitting: cookie | owned | `splitting-cookie-withoutProbedLocation` | none |
| `league/openapi-psr7-validator` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `league/openapi-psr7-validator` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `league/openapi-psr7-validator` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `league/openapi-psr7-validator` | styleDeserialization | owned | `style-deserialization-array-path`, `style-deserialization-array-query` | `style-deserialization-array-header` |
| `league/openapi-psr7-validator` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `league/openapi-psr7-validator` | schemaValidation | owned | `schema-validation-enum` | none |
| `league/openapi-psr7-validator` | valueExposure | caller | nothing, which is what a disclaim predicts | `value-exposure-accepted`, `value-exposure-write-back` (consistent with the disclaim) |
| `@oaverify/core` | routing | owned | `routing-method` | none |
| `@oaverify/core` | splitting: cookie | caller | nothing, which is what a disclaim predicts | `splitting-cookie-withoutProbedLocation` (consistent with the disclaim) |
| `@oaverify/core` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `@oaverify/core` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `@oaverify/core` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `@oaverify/core` | styleDeserialization | owned | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` | none |
| `@oaverify/core` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `@oaverify/core` | schemaValidation | owned | `schema-validation-enum` | none |
| `@oaverify/core` | valueExposure | owned | `value-exposure-accepted` | `value-exposure-write-back` |
| `openapi-backend` | routing | owned | `routing-method` | none |
| `openapi-backend` | splitting: cookie | owned | `splitting-cookie-withoutProbedLocation` | none |
| `openapi-backend` | splitting: header | caller | nothing, which is what a disclaim predicts | `splitting-header-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-backend` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `openapi-backend` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `openapi-backend` | styleDeserialization | owned | `style-deserialization-array-query` | `style-deserialization-array-header`, `style-deserialization-array-path` |
| `openapi-backend` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `openapi-backend` | schemaValidation | owned | `schema-validation-enum` | none |
| `openapi-backend` | valueExposure | owned | `value-exposure-accepted` | `value-exposure-write-back` |
| `openapi-core` | routing | owned | `routing-method` | none |
| `openapi-core` | splitting: cookie | caller | nothing, which is what a disclaim predicts | `splitting-cookie-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-core` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `openapi-core` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `openapi-core` | splitting: query | caller | nothing, which is what a disclaim predicts | `splitting-query-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-core` | styleDeserialization | owned | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` | none |
| `openapi-core` | contentDeserialization | owned | nothing this run could show, so the claim is unbacked here | `content-deserialization-json-object` |
| `openapi-core` | schemaValidation | owned | `schema-validation-enum` | none |
| `openapi-core` | valueExposure | owned | `value-exposure-accepted`, `value-exposure-write-back` | none |
| `openapi-request-validator` | routing | caller | nothing, which is what a disclaim predicts | `routing-method` (consistent with the disclaim) |
| `openapi-request-validator` | splitting: cookie | caller | nothing, which is what a disclaim predicts | `splitting-cookie-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-request-validator` | splitting: header | caller | nothing, which is what a disclaim predicts | `splitting-header-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-request-validator` | splitting: path | caller | nothing, which is what a disclaim predicts | `splitting-path-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-request-validator` | splitting: query | caller | nothing, which is what a disclaim predicts | `splitting-query-withoutProbedLocation` (consistent with the disclaim) |
| `openapi-request-validator` | styleDeserialization | caller | nothing, which is what a disclaim predicts | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` (consistent with the disclaim) |
| `openapi-request-validator` | contentDeserialization | caller | nothing, which is what a disclaim predicts | `content-deserialization-json-object` (consistent with the disclaim) |
| `openapi-request-validator` | schemaValidation | owned | `schema-validation-enum` | none |
| `openapi-request-validator` | valueExposure | owned | `value-exposure-write-back` | `value-exposure-accepted` |
| `openapi_first` | routing | owned | `routing-method` | none |
| `openapi_first` | splitting: cookie | owned | `splitting-cookie-withoutProbedLocation` | none |
| `openapi_first` | splitting: header | owned | `splitting-header-withoutProbedLocation` | none |
| `openapi_first` | splitting: path | owned | `splitting-path-withoutProbedLocation` | none |
| `openapi_first` | splitting: query | owned | `splitting-query-withoutProbedLocation` | none |
| `openapi_first` | styleDeserialization | owned | `style-deserialization-array-header`, `style-deserialization-array-path`, `style-deserialization-array-query` | none |
| `openapi_first` | contentDeserialization | owned | `content-deserialization-json-object` | none |
| `openapi_first` | schemaValidation | owned | `schema-validation-enum` | none |
| `openapi_first` | valueExposure | owned | `value-exposure-accepted`, `value-exposure-write-back` | none |

### `com.atlassian.oai:openapi-request-validator-core`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | caller | not asked (the request builder exposes no cookie API, so a cookie parameter cannot be put to the library at all; supplying it as a raw header would measure this adapter's cookie split rather than the library) | not asked (the request builder exposes no cookie API, so a cookie parameter cannot be put to the library at all; supplying it as a raw header would measure this adapter's cookie split rather than the library) | disclaimed, and not shown |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | caller | not asked (the request builder exposes no cookie API, so a cookie parameter cannot be put to the library at all; supplying it as a raw header would measure this adapter's cookie split rather than the library) | not asked (the request builder exposes no cookie API, so a cookie parameter cannot be put to the library at all; supplying it as a raw header would measure this adapter's cookie split rather than the library) | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | caller | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | rejected, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | rejected, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | rejected, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | caller | accepted, no values exposed | accepted, no values exposed | disclaimed, and not shown |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |

### `express-openapi-validator`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | caller | accepted, no values exposed | accepted, no values exposed | disclaimed, and not shown |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | caller | accepted, no values exposed | accepted, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the value it exposed |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, value exposed | rejected, value exposed | demonstrated by the value it exposed |

### `github.com/getkin/kin-openapi`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, value exposed | rejected, no values exposed | demonstrated by the value it exposed |

### `github.com/pb33f/libopenapi-validator`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, no values exposed | accepted, no values exposed | declared, and this probe did not show it |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, no values exposed | accepted, no values exposed | declared, and this probe did not show it |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |

### `league/openapi-psr7-validator`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | rejected, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | caller | accepted, no values exposed | rejected, no values exposed | disclaimed, and not shown |

### `@oaverify/core`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | caller | rejected, values exposed without the probed name | rejected, values exposed without the probed name | disclaimed, and not shown |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | caller | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the value it exposed |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, values exposed without the probed name | rejected, values exposed without the probed name | declared, and this probe did not show it |

### `openapi-backend`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, value exposed | raised, no verdict | exercised, and raised on the invalid side rather than returning a verdict |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | caller | rejected, values exposed without the probed name | rejected, values exposed without the probed name | disclaimed, and not shown |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | caller | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | rejected, value exposed | rejected, value exposed | declared, and this probe did not show it |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | rejected, value exposed | rejected, value exposed | declared, and this probe did not show it |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, value exposed | raised, no verdict | exercised, and raised on the invalid side rather than returning a verdict |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, value exposed | rejected, value exposed | demonstrated by the value it exposed |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, values exposed without the probed name | rejected, value exposed | declared, and this probe did not show it |

### `openapi-core`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | caller | rejected, values exposed without the probed name | rejected, values exposed without the probed name | disclaimed, and not shown |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | caller | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | caller | rejected, values exposed without the probed name | rejected, values exposed without the probed name | disclaimed, and not shown |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | caller | accepted, value exposed | rejected, values exposed without the probed name | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | rejected, values exposed without the probed name | rejected, values exposed without the probed name | declared, and this probe did not show it |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the value it exposed |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the value it exposed |

### `openapi-request-validator`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | caller | accepted, no values exposed | accepted, no values exposed | disclaimed, and not shown |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | caller | accepted, no values exposed | accepted, no values exposed | disclaimed, and not shown |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | caller | accepted, no values exposed | accepted, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | caller | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | caller | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | caller | accepted, no values exposed | rejected, no values exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | caller | rejected, no values exposed | rejected, no values exposed | disclaimed, and not shown |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | caller | accepted, no values exposed | accepted, no values exposed | disclaimed, and not shown |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, no values exposed | rejected, no values exposed | declared, and this probe did not show it |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, value exposed | rejected, no values exposed | demonstrated by the value it exposed |

### `openapi_first`

| probe | asks | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `routing-method` | whether a request for an undeclared method reaches an operation at all | owned | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `splitting-cookie-withoutProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying its usual split for every location except cookie | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-cookie-withProbedLocation` | whether a declared cookie parameter's value is recovered, with the harness supplying the cookie split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-header-withoutProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying its usual split for every location except header | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-header-withProbedLocation` | whether a declared header parameter's value is recovered, with the harness supplying the header split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-path-withoutProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying its usual split for every location except path | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-path-withProbedLocation` | whether a declared path parameter's value is recovered, with the harness supplying the path split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `splitting-query-withoutProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying its usual split for every location except query | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `splitting-query-withProbedLocation` | whether a declared query parameter's value is recovered, with the harness supplying the query split itself | owned | accepted, value exposed | rejected, value exposed | control only; the harness supplied this location, so this row is not evidence |
| `style-deserialization-array-header` | whether a comma-joined header array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-path` | whether a comma-joined path array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `style-deserialization-array-query` | whether a comma-joined query array is split before its members are judged | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `content-deserialization-json-object` | whether a content parameter's value is read as its declared media type | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `schema-validation-enum` | whether a recovered value is judged against its schema | owned | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `value-exposure-accepted` | whether the deserialized value of an accepted parameter is handed back | owned | accepted, value exposed | rejected, value exposed | demonstrated by the value it exposed |
| `value-exposure-write-back` | whether a value the library supplied for an absent optional parameter reaches the caller | owned | accepted, value exposed | rejected, value exposed | demonstrated by the value it exposed |

## Specification versions

Which OpenAPI versions each container declares its library accepts documents
of. A declaration names a minor line: 3.1 means 3.1.x documents, and the
citations pin exact patch revisions where exactness matters. The runner asks a
library only the cases whose version it declares; the rest render as `n/a`
with `oasVersionNotDeclared` as the reason.

Every version the protocol knows is probed, declared or not, with an ordinary
document of that version: a valid request on one side and a value outside the
schema's enumeration on the other. Like every probe, this demonstrates and
never refutes: a library can reject the valid side out of strictness about
something else entirely, so a declared version no probe showed is published as
an unbacked claim rather than treated as false.

| library | version | declared | accepted side | rejected side | reading |
| --- | --- | --- | --- | --- | --- |
| `com.atlassian.oai:openapi-request-validator-core` | 3.0 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `com.atlassian.oai:openapi-request-validator-core` | 3.1 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `com.atlassian.oai:openapi-request-validator-core` | 3.2 | no | not asked (com.atlassian.oai.validator.OpenApiInteractionValidator$ApiLoadException: Unable to load API spec from provided URL or payload:
	- attribute paths.'/t'(get).[p].schema is unexpected
	- attribute openapi is unexpected
	- attribute swagger is missing
	- attribute paths.'/t'(get).[p].type is missing) | not asked (com.atlassian.oai.validator.OpenApiInteractionValidator$ApiLoadException: Unable to load API spec from provided URL or payload:
	- attribute paths.'/t'(get).[p].schema is unexpected
	- attribute openapi is unexpected
	- attribute swagger is missing
	- attribute paths.'/t'(get).[p].type is missing) | disclaimed, and not shown |
| `express-openapi-validator` | 3.0 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `express-openapi-validator` | 3.1 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `express-openapi-validator` | 3.2 | no | raised, no verdict | raised, no verdict | disclaimed, and not shown |
| `github.com/getkin/kin-openapi` | 3.0 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `github.com/getkin/kin-openapi` | 3.1 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `github.com/getkin/kin-openapi` | 3.2 | no | accepted, no values exposed | rejected, no values exposed | disclaimed, and demonstrated by the pair of verdicts |
| `github.com/pb33f/libopenapi-validator` | 3.0 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `github.com/pb33f/libopenapi-validator` | 3.1 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `github.com/pb33f/libopenapi-validator` | 3.2 | no | accepted, no values exposed | rejected, no values exposed | disclaimed, and demonstrated by the pair of verdicts |
| `league/openapi-psr7-validator` | 3.0 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `league/openapi-psr7-validator` | 3.1 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `league/openapi-psr7-validator` | 3.2 | no | accepted, no values exposed | rejected, no values exposed | disclaimed, and demonstrated by the pair of verdicts |
| `@oaverify/core` | 3.0 | yes | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `@oaverify/core` | 3.1 | yes | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `@oaverify/core` | 3.2 | no | accepted, value exposed | rejected, values exposed without the probed name | disclaimed, and demonstrated by the pair of verdicts |
| `openapi-backend` | 3.0 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `openapi-backend` | 3.1 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `openapi-backend` | 3.2 | no | accepted, value exposed | rejected, value exposed | disclaimed, and demonstrated by the pair of verdicts |
| `openapi-core` | 3.0 | yes | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `openapi-core` | 3.1 | yes | accepted, value exposed | rejected, values exposed without the probed name | demonstrated by the pair of verdicts |
| `openapi-core` | 3.2 | no | accepted, value exposed | rejected, values exposed without the probed name | disclaimed, and demonstrated by the pair of verdicts |
| `openapi-request-validator` | 3.0 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `openapi-request-validator` | 3.1 | yes | accepted, no values exposed | rejected, no values exposed | demonstrated by the pair of verdicts |
| `openapi-request-validator` | 3.2 | no | accepted, no values exposed | rejected, no values exposed | disclaimed, and demonstrated by the pair of verdicts |
| `openapi_first` | 3.0 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `openapi_first` | 3.1 | yes | accepted, value exposed | rejected, value exposed | demonstrated by the pair of verdicts |
| `openapi_first` | 3.2 | no | not asked (OpenapiFirst::Error: Unsupported OpenAPI version "3.2.0" ) | not asked (OpenapiFirst::Error: Unsupported OpenAPI version "3.2.0" ) | disclaimed, and not shown |

## Configuration

### `com.atlassian.oai:openapi-request-validator-core`

`inline-spec-simple-request`: OpenApiInteractionValidator.createForInlineApiSpecification(document).build(), driven through validateRequest with a SimpleRequest built from the raw path. Raw query name/value pairs come from the harness preparse with no percent decoding: the builder takes a name and values and there is no API accepting a query string, so the split into pairs is the caller's and is recorded on every cell. Duplicate raw names are grouped into the list shape the builder accepts. Values are permanently unexposed: ValidationReport carries hasErrors and getMessages and no channel for what was deserialized. Known limitation: the request builder has no cookie API, so cookie parameters cannot be put to the library through it and those cases are refused here rather than answered.

### `express-openapi-validator`

`middleware-validate-requests`: OpenApiValidator.middleware({ apiSpec, validateRequests: true }) mounted on an express app, exactly as the published usage shows, with a handler that echoes the request it received and an error handler that reports the thrown status alongside the same request fields. Reading its values: on an accepted request they are what the handler was handed. On a rejected one they are what the middleware had coerced onto the request before it stopped, so they are partial and stop at the first failure.

### `github.com/getkin/kin-openapi`

`validate-request-gorillamux`: openapi3.NewLoader().LoadFromData(document) routed with gorillamux and validated through openapi3filter.ValidateRequest, driven from an http.Request built from the raw target. Known limitation: Go's net/url parses the target before the library sees it, so percent-encoding probes measure that parser as well as the library. The escaped path is what reaches the router, so the encoding survives to that point. Values are read from a write-back channel: the function that decodes a styled parameter is unexported and no published call returns decoded values, and ValidateRequest writes values it supplies, such as schema defaults for absent query parameters, back onto the http.Request it was handed. This adapter reports the declared parameters whose values changed across the call, at vantage parsedBeforeValidation. An input the library left unchanged reports no values.

### `github.com/pb33f/libopenapi-validator`

`validate-http-request`: libopenapi.NewDocument(document) handed to validator.NewValidator and driven through ValidateHttpRequest, from an http.Request built on the raw target. Routing is the library's: an unmatched path comes back as a validation error of type path rather than as a separate call. Known limitation: Go's net/url parses the target before the library sees it, so percent-encoding probes measure that parser as well as the library. The escaped path is what reaches the validator, so the encoding survives to that point. Values are unexposed: ValidateHttpRequest answers with a boolean and a list of validation errors, and the helpers that decode a styled parameter are internal packages, so no published call hands the deserialized values back.

### `league/openapi-psr7-validator`

`request-validator-psr7`: ValidatorBuilder::fromJson(document) driven through getRequestValidator()->validate(), with a PSR-7 RequestInterface built from the raw target. The plain request validator is used rather than the server request one, because the plain one reads the Cookie header itself where the server one takes a cookie array from its caller, so every location stays the library's. Known limitation: the PSR-7 URI type parses the target before the library sees it, so percent-encoding probes measure that parser as well as the library. Existing percent-encoded sequences reach the validator unchanged. Values are unexposed: validate() answers with an OperationAddress or raises, and the deserializer that converts a styled parameter is not reachable from the published validation call.

### `@oaverify/core`

`request-return-values`: createValidator(document, { returnValues: true }), driven through validateRequest, which the library documents as its per-call HTTP entry point and validateFetchRequest as a convenience wrapper over. The path is handed over with its query string still in it, because the library documents that it reads the query out of the path when the query field is unset, so splitting the query stays its work. Headers are handed over as its request shape spells them, one entry per name with repeats collected, and with their case as the wire carried it, so matching a header name to the declaration stays its work too. Cookies are the harness's split, which this configuration declares, and the request shape holds one string per cookie name, so a case sending a name twice or a crumb with no `=` is answered as a case this shape cannot represent, rather than on what survived. Reading its values: the library documents that a parameter appears in the value channel when this call reached it, deserialized it, and its schema accepted the result. So an empty value cell on a rejected row means the parameter did not pass, which is a different fact from a library that reports a coerced value alongside its own rejection.

### `openapi-backend`

`coerce-types-on`: new OpenAPIBackend({ definition, quick: false, coerceTypes: true }) then init(), driven through validateRequest with the raw path and raw query string. coerceTypes is enabled because leaving it off rejects every typed parameter; both settings were measured and the results were identical for path parameters.

### `openapi-core`

`unmarshal-request-protocol`: OpenAPI.from_dict(document) driven through unmarshal_request, with a request object implementing the library's published Request protocol rather than its testing helper. The raw path is handed over unparsed, so routing and path parameter extraction are the library's. Raw query name/value pairs come from the harness preparse with no percent decoding: this library takes a query mapping and raises PathNotFound if a query string is left in the path, so the split into pairs is the caller's and is recorded on every cell. Style and explode are still applied by the library to those pairs. Cookie pairs go in as the MultiDict this library documents for that field, so a repeated cookie name reaches it rather than being collapsed on the way in. Every value in both mappings is a string, so a query pair or a cookie crumb that arrived with no `=` at all is answered as a case this shape cannot represent rather than handed over as an empty value. Reading its values: a parameter appears once it was reached, deserialized and accepted by its schema, so an empty value cell on a rejected row means that parameter did not pass rather than that it deserialized to nothing.

### `openapi-request-validator`

`parameters-only`: new OpenAPIRequestValidator({ parameters }) with the operation's parameters, called with { params, query, headers }. Query arrives from the harness as raw name/value pairs with no percent decoding, then this adapter collapses duplicate raw names into the object shape validateRequest accepts. That shape holds a string per name, so a query pair that arrived with no `=` is answered as a case this shape cannot represent, rather than as an empty value. It is told which operation applies, because it has no routing of its own. Values are read from a write-back channel: validateRequest returns errors only, and its schema engine writes coerced values and schema defaults onto the params, query and headers object it is handed. This adapter reports the declared parameters whose values changed across the call, at vantage parsedBeforeValidation. An input the library left unchanged reports no values.

### `openapi_first`

`validate-request-rack`: OpenapiFirst.parse(document) driven through validate_request with a Rack::Request built from the raw target. The path is handed over as PATH_INFO with no decoding of its own, and the query string as QUERY_STRING, so the library splits and deserializes both. Header names are put into the Rack environment under its own convention, which upcases them and joins duplicates with a comma, because that environment is the only request shape this library's public call accepts. Reading its values: parsed parameters are reported whether or not the request was then rejected, so a value cell on a rejected row shows what the library had parsed at the point it refused rather than what it accepted.
