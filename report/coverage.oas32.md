# Coverage, OpenAPI 3.2

Enumerated from the specification, not from the corpus. A corpus-derived map
would be complete by construction and would say nothing. Every empty cell
below is a case nobody has written yet.

Defined combinations: 48. Covered: 10. Empty: 38.

Combinations the specification marks undefined are excluded from the surface
and probed as divergence cases instead.

Nullable schemas are excluded too, for a different reason worth keeping
separate from that one. Those are excluded because the specification marks
them n/a; nullability is excluded because this map is about how a value is
written, and nullability does not affect that. OpenAPI defers to RFC 6570 for
which values are undefined, that list includes null, and an undefined variable
is ignored by the expansion process. A null-valued parameter has no wire form,
and a non-null one is written the same whether or not null is also admitted.
Enumerating nullable variants added 41 cells whose cases would have duplicated
41 existing wire forms exactly. It is probed on its own axis instead, under
case ids carrying `nullable`.

| location | style | explode | schema | covered |
| --- | --- | --- | --- | --- |
| cookie | cookie | false | array | yes |
| cookie | cookie | false | object | yes |
| cookie | cookie | false | scalar | yes |
| cookie | cookie | true | array | yes |
| cookie | cookie | true | object | yes |
| cookie | cookie | true | scalar | yes |
| cookie | form | false | array |  |
| cookie | form | false | object |  |
| cookie | form | false | scalar |  |
| cookie | form | true | array | yes |
| cookie | form | true | object |  |
| cookie | form | true | scalar |  |
| header | simple | false | array |  |
| header | simple | false | object |  |
| header | simple | false | scalar |  |
| header | simple | true | array |  |
| header | simple | true | object |  |
| header | simple | true | scalar |  |
| path | label | false | array |  |
| path | label | false | object |  |
| path | label | false | scalar |  |
| path | label | true | array |  |
| path | label | true | object |  |
| path | label | true | scalar |  |
| path | matrix | false | array |  |
| path | matrix | false | object |  |
| path | matrix | false | scalar |  |
| path | matrix | true | array |  |
| path | matrix | true | object |  |
| path | matrix | true | scalar |  |
| path | simple | false | array |  |
| path | simple | false | object |  |
| path | simple | false | scalar | yes |
| path | simple | true | array |  |
| path | simple | true | object |  |
| path | simple | true | scalar |  |
| query | deepObject | false | object | yes |
| query | deepObject | true | object | yes |
| query | form | false | array |  |
| query | form | false | object |  |
| query | form | false | scalar |  |
| query | form | true | array |  |
| query | form | true | object |  |
| query | form | true | scalar |  |
| query | pipeDelimited | false | array |  |
| query | pipeDelimited | false | object |  |
| query | spaceDelimited | false | array |  |
| query | spaceDelimited | false | object |  |

## Declared value types

The table above is about how a value is written, and the type a schema declares
for it does not change that. So the types get an axis of their own instead of a
fifth column, the same treatment nullability gets and for the same reason.

Enumerated from the specification: the JSON Schema data model recognises
strings, numbers, booleans and null, and `integer` is a convenience defined
mathematically over numbers. `object` and `array` are containers and the
`schema` column above already enumerates them.

`wrong value probed` is the column that matters. Declaring a type only shows a
library the shape it should accept, and it is a value of the wrong type that
shows whether the type was checked at all.

| type | cases declaring it | wrong value probed |
| --- | --- | --- |
| `boolean` | 0 |  |
| `integer` | 1 | `querystring-form-urlencoded-object-wrong-type-oas32` |
| `null` | 0 |  |
| `number` | 0 |  |
| `string` | 21 | `querystring-form-urlencoded-object-wrong-type-oas32` |

A wrong-typed value against `string` cannot be constructed here. Every value on
the wire is text, so there is nothing to send that a string schema must refuse,
and that cell is empty by definition rather than by omission. Every other empty
cell is a case nobody has written.

## Content representation surface

The table above enumerates style serialization, and a parameter declaring
`content` has no style and no explode to place in it. Those cases were in the
corpus and in no coverage map. This is their map.

Defined combinations: 60. Covered: 2. Empty: 58.

Mostly empty, and published that way. The corpus has 9 content cases and this
surface has room for far more, so this table keeps the empty cells visible.
Filling it to look full would make the coverage number less informative.

Almost no legality filter applies, unlike the style table. The Style Values
table marks some style, location and type combinations n/a; `content` has no
such table, is permitted in every location this version defines, and is not
restricted by schema shape or media type. So every empty cell here is a case
nobody has written, and none of them is a combination the specification
excludes.

The one filter is which locations the version defines. `querystring` is defined
by 3.2 and by no earlier version, so it has rows in the 3.2 table alone. A
querystring row in a 3.0 or 3.1 table would be a cell nobody can fill rather
than one nobody has filled, and the two must not be counted alike.

`condition` is the axis a style surface has no room for. A media type
representation can be a value that is not a representation of it, and what a
library does with that is a different question from what it does with a
well-formed one. A case carrying `foreignWireShape` fills a `malformed` cell.

Media types enumerated: `application/json`, `application/x-www-form-urlencoded`.
That is what the corpus declares. A library's handling of `application/xml` or
`text/plain` is unmeasured here rather than absent, and widening the axis means
writing cases that send them.

| location | media type | schema | condition | covered |
| --- | --- | --- | --- | --- |
| cookie | application/json | array | malformed |  |
| cookie | application/json | array | wellFormed |  |
| cookie | application/json | object | malformed |  |
| cookie | application/json | object | wellFormed |  |
| cookie | application/json | scalar | malformed |  |
| cookie | application/json | scalar | wellFormed |  |
| cookie | application/x-www-form-urlencoded | array | malformed |  |
| cookie | application/x-www-form-urlencoded | array | wellFormed |  |
| cookie | application/x-www-form-urlencoded | object | malformed |  |
| cookie | application/x-www-form-urlencoded | object | wellFormed |  |
| cookie | application/x-www-form-urlencoded | scalar | malformed |  |
| cookie | application/x-www-form-urlencoded | scalar | wellFormed |  |
| header | application/json | array | malformed |  |
| header | application/json | array | wellFormed |  |
| header | application/json | object | malformed |  |
| header | application/json | object | wellFormed |  |
| header | application/json | scalar | malformed |  |
| header | application/json | scalar | wellFormed |  |
| header | application/x-www-form-urlencoded | array | malformed |  |
| header | application/x-www-form-urlencoded | array | wellFormed |  |
| header | application/x-www-form-urlencoded | object | malformed |  |
| header | application/x-www-form-urlencoded | object | wellFormed |  |
| header | application/x-www-form-urlencoded | scalar | malformed |  |
| header | application/x-www-form-urlencoded | scalar | wellFormed |  |
| path | application/json | array | malformed |  |
| path | application/json | array | wellFormed |  |
| path | application/json | object | malformed |  |
| path | application/json | object | wellFormed |  |
| path | application/json | scalar | malformed |  |
| path | application/json | scalar | wellFormed |  |
| path | application/x-www-form-urlencoded | array | malformed |  |
| path | application/x-www-form-urlencoded | array | wellFormed |  |
| path | application/x-www-form-urlencoded | object | malformed |  |
| path | application/x-www-form-urlencoded | object | wellFormed |  |
| path | application/x-www-form-urlencoded | scalar | malformed |  |
| path | application/x-www-form-urlencoded | scalar | wellFormed |  |
| query | application/json | array | malformed |  |
| query | application/json | array | wellFormed |  |
| query | application/json | object | malformed |  |
| query | application/json | object | wellFormed |  |
| query | application/json | scalar | malformed |  |
| query | application/json | scalar | wellFormed |  |
| query | application/x-www-form-urlencoded | array | malformed |  |
| query | application/x-www-form-urlencoded | array | wellFormed |  |
| query | application/x-www-form-urlencoded | object | malformed |  |
| query | application/x-www-form-urlencoded | object | wellFormed |  |
| query | application/x-www-form-urlencoded | scalar | malformed |  |
| query | application/x-www-form-urlencoded | scalar | wellFormed |  |
| querystring | application/json | array | malformed |  |
| querystring | application/json | array | wellFormed |  |
| querystring | application/json | object | malformed |  |
| querystring | application/json | object | wellFormed | yes |
| querystring | application/json | scalar | malformed |  |
| querystring | application/json | scalar | wellFormed |  |
| querystring | application/x-www-form-urlencoded | array | malformed |  |
| querystring | application/x-www-form-urlencoded | array | wellFormed |  |
| querystring | application/x-www-form-urlencoded | object | malformed |  |
| querystring | application/x-www-form-urlencoded | object | wellFormed | yes |
| querystring | application/x-www-form-urlencoded | scalar | malformed |  |
| querystring | application/x-www-form-urlencoded | scalar | wellFormed |  |

A case that breaks a rule addressed to whoever wrote the document fills no cell
here, and 4 content cases are excluded on that rule: `querystring-beside-query-oas32`, `querystring-content-with-style-oas32`, `querystring-declared-twice-oas32`, `querystring-declared-with-schema-oas32`. They vary the
declaration rather than the representation, so counting them would mark a
representation covered that nothing has sent. They appear in `matrix.oas32.md`.

Every remaining content case lands in a cell above.

## Specification sections exercised

Case ids name the surface under probe, such as location, style, schema shape
and what the case varies. They do not name the specification section, which
lives in the citation. This index reads the other way, from section to cases,
so a reader starting at a paragraph of the specification can find every case
resting on it, and can see which cited sections carry only one.

| section | cases |
| --- | --- |
| fixed-fields-for-use-with-content | `querystring-absent-no-question-mark-oas32`, `querystring-empty-after-question-mark-oas32`, `querystring-form-urlencoded-object-canonical-oas32`, `querystring-form-urlencoded-object-wrong-type-oas32` |
| fixed-fields-for-use-with-schema | `cookie-cookie-scalar-percent-triple-oas32` |
| parameter-allow-reserved | `path-simple-scalar-allow-reserved-declared-oas32`, `path-simple-scalar-allow-reserved-unset-oas32` |
| parameter-explode | `cookie-cookie-array-canonical-explode-oas32`, `cookie-cookie-array-no-explode-oas32`, `cookie-cookie-object-canonical-explode-oas32`, `cookie-cookie-object-no-explode-oas32`, `cookie-cookie-scalar-canonical-oas32`, `cookie-cookie-scalar-no-explode-oas32`, `query-deep-object-no-explode-oas32` |
| parameter-locations | `querystring-absent-no-question-mark-oas32`, `querystring-empty-after-question-mark-oas32`, `querystring-form-urlencoded-object-canonical-oas32`, `querystring-form-urlencoded-object-wrong-type-oas32` |
| parameter-required | `querystring-absent-no-question-mark-oas32`, `querystring-empty-after-question-mark-oas32`, `querystring-form-urlencoded-object-canonical-oas32`, `querystring-form-urlencoded-object-wrong-type-oas32` |
| parameter-style | `cookie-cookie-array-canonical-explode-oas32`, `cookie-cookie-array-no-explode-oas32`, `cookie-cookie-object-canonical-explode-oas32`, `cookie-cookie-object-no-explode-oas32`, `cookie-cookie-scalar-canonical-oas32`, `cookie-cookie-scalar-no-explode-oas32`, `cookie-cookie-scalar-percent-triple-oas32`, `path-simple-scalar-allow-reserved-declared-oas32`, `query-deep-object-canonical-oas32`, `query-deep-object-no-explode-oas32` |
| percent-encoding-and-cookies | `cookie-form-array-explode-oas32` |
| schema-object | `cookie-cookie-array-canonical-explode-oas32`, `cookie-cookie-array-no-explode-oas32`, `cookie-cookie-object-canonical-explode-oas32`, `cookie-cookie-object-no-explode-oas32`, `cookie-cookie-scalar-canonical-oas32`, `cookie-cookie-scalar-no-explode-oas32`, `cookie-cookie-scalar-percent-triple-oas32`, `path-simple-scalar-allow-reserved-declared-oas32`, `query-deep-object-canonical-oas32`, `query-deep-object-no-explode-oas32`, `querystring-form-urlencoded-object-canonical-oas32`, `querystring-form-urlencoded-object-wrong-type-oas32` |
| style-examples | `cookie-cookie-array-canonical-explode-oas32`, `cookie-cookie-array-no-explode-oas32`, `cookie-cookie-object-canonical-explode-oas32`, `cookie-cookie-object-no-explode-oas32`, `cookie-cookie-scalar-canonical-oas32`, `cookie-cookie-scalar-no-explode-oas32`, `path-simple-scalar-allow-reserved-declared-oas32`, `query-deep-object-canonical-oas32`, `query-deep-object-no-explode-oas32` |
| style-values | `cookie-cookie-array-canonical-explode-oas32`, `cookie-cookie-array-no-explode-oas32`, `cookie-cookie-object-canonical-explode-oas32`, `cookie-cookie-object-no-explode-oas32`, `cookie-cookie-scalar-canonical-oas32`, `cookie-cookie-scalar-no-explode-oas32`, `cookie-cookie-scalar-percent-triple-oas32`, `query-deep-object-canonical-oas32`, `query-deep-object-no-explode-oas32` |

Cases resting on no cited section, because the specification is silent: `querystring-beside-query-oas32`, `querystring-content-with-style-oas32`, `querystring-declared-twice-oas32`, `querystring-declared-with-schema-oas32`, `querystring-json-object-canonical-oas32`.

## Default resolution

Whether a case writes style and explode out or leaves them to the default.
Leaving them out puts the library's default resolution under test before any
deserialization happens, so it is a different code path rather than a
different value. A corpus written by hand reaches for the declared form, so
this axis is the one most likely to be quietly empty.

The defaulted path is reported to be far more common in published documents
than any declared style. That report is not this repository's measurement:
see Figures from elsewhere, below.

| location | style declared | explode declared | cases |
| --- | --- | --- | --- |
| cookie | yes | 3 of 7 | 7 |
| cookie | no | 0 of 1 | 1 |
| header | yes | 0 of 0 | 0 |
| header | no | 0 of 0 | 0 |
| path | yes | 0 of 0 | 0 |
| path | no | 0 of 2 | 2 |
| query | yes | 2 of 2 | 2 |
| query | no | 0 of 0 | 0 |

## Figures from elsewhere

Every other number in this report traces to stored raw output in `report/libraries/<slug>.json`.
The figures below do not, because this repository did not measure them. They
are recorded here, attributed, and kept off the measurement tables, where they
would read as though they had been.

### declared-style-exposure

Most published parameters declare no style, so the default-resolution path carries more real traffic than any declared style, and matrix and label carry almost none.

- 301 documents surveyed, 56,555 parameters
- style undeclared on 52,027 parameters (91.99%)
- explode undeclared on 52,989 of 56,555
- matrix declared in 0 of 301 documents, label in 0 of 301
- 263 of 301 documents are OpenAPI 3.0

Reported by the engagement coordinator on 2026-08-08, from the APIs.guru corpus. **Not reproduced by this repository.**

To reproduce it: download the corpus at a recorded version, count parameters by declared style and location, and commit the resulting dataset so the figures trace to stored output the way every other number in this report does.

## Probe axes

The serialization surface is one dimension. The other is what each case varies
away from canonical, and an axis with no cases is a blind spot the table above
cannot show.

| probe axis | cases |
| --- | --- |
| canonical | 9 |
| caseVariant | 0 |
| competingParameter | 1 |
| competingPath | 0 |
| declarationFlag | 4 |
| duplicateName | 1 |
| emptyAfterParse | 0 |
| emptyContainer | 1 |
| encodingVariant | 2 |
| foreignName | 0 |
| foreignWireShape | 1 |
| missingName | 0 |
| nameWithoutValue | 0 |
| optionalAbsent | 1 |
| wrongTypeValue | 1 |

## Cases by the stage they probe

Which stage of the request-validation pipeline each case exists to probe,
derived from the axis it varies and the location it varies it in.

A coverage map in its own right, and a blunter one than the surface table. A
corpus concentrated on one stage is blind to the rest however many cases it
holds, because the stages it does not probe are the ones it holds constant.
Filling the surface table does not fix that on its own: every empty cell there
would be filled by a canonical case, and canonical probes style.

| probed stage | conformance | divergence |
| --- | --- | --- |
| routing | 0 | 0 |
| splitting | 1 | 0 |
| styleDeserialization | 9 | 2 |
| contentDeserialization | 2 | 5 |
| schemaValidation | 2 | 0 |

`valueExposure` is a pipeline stage and has no row here, which is deliberate and
is a correction. It had one, reading `0` and `0`, and that read as a gap someone
could fill by writing cases. No case can fill it. A case probes a stage by
varying something and seeing whether the verdict moves, and exposure changes no
verdict: a library hands back the values it parsed or it does not, whatever the
request was. Removing the row keeps the table from advertising work that would
not change the coverage.

Exposure is asked of every case that carries expected values, as the second half
of that case, and it is reported per library in `capabilities.md` under what each
library exposed and from what vantage. That is where its coverage lives.

## Held constant across every case

A constant is a blind spot, so the deliberate ones are published here rather
than left invisible. Each is a decision a future case can overturn, and one
already was: every declaration was required until the optional-absent axis
existed.

- Request method: GET only. Method matching is routing
  surface nothing here varies.
- No request bodies. Parameters are the subject, and a body brings a second
  deserialization pipeline whose failures a case could not tell apart from
  the first's.
- One operation per path and one declared parameter, except where a case
  names the competition it stages.
