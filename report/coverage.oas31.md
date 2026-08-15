# Coverage, OpenAPI 3.1

Enumerated from the specification, not from the corpus. A corpus-derived map
would be complete by construction and would say nothing. Every empty cell
below is a case nobody has written yet.

Defined combinations: 41. Covered: 41. Empty: 0.

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
| cookie | form | false | array | yes |
| cookie | form | false | object | yes |
| cookie | form | false | scalar | yes |
| cookie | form | true | array | yes |
| cookie | form | true | object | yes |
| cookie | form | true | scalar | yes |
| header | simple | false | array | yes |
| header | simple | false | object | yes |
| header | simple | false | scalar | yes |
| header | simple | true | array | yes |
| header | simple | true | object | yes |
| header | simple | true | scalar | yes |
| path | label | false | array | yes |
| path | label | false | object | yes |
| path | label | false | scalar | yes |
| path | label | true | array | yes |
| path | label | true | object | yes |
| path | label | true | scalar | yes |
| path | matrix | false | array | yes |
| path | matrix | false | object | yes |
| path | matrix | false | scalar | yes |
| path | matrix | true | array | yes |
| path | matrix | true | object | yes |
| path | matrix | true | scalar | yes |
| path | simple | false | array | yes |
| path | simple | false | object | yes |
| path | simple | false | scalar | yes |
| path | simple | true | array | yes |
| path | simple | true | object | yes |
| path | simple | true | scalar | yes |
| query | deepObject | true | object | yes |
| query | form | false | array | yes |
| query | form | false | object | yes |
| query | form | false | scalar | yes |
| query | form | true | array | yes |
| query | form | true | object | yes |
| query | form | true | scalar | yes |
| query | pipeDelimited | false | array | yes |
| query | pipeDelimited | false | object | yes |
| query | spaceDelimited | false | array | yes |
| query | spaceDelimited | false | object | yes |

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
| `boolean` | 2 | `query-form-boolean-wrong-type-oas31` |
| `integer` | 7 | `path-matrix-scalar-wrong-type-oas31`, `path-simple-scalar-wrong-type-oas31`, `query-form-object-wrong-type-oas31`, `query-form-scalar-integer-fractional-oas31` |
| `null` | 3 | `query-form-scalar-nullable-literal-oas31` |
| `number` | 0 |  |
| `string` | 76 | `query-form-object-wrong-type-oas31`, `query-form-scalar-nullable-literal-oas31` |

A wrong-typed value against `string` cannot be constructed here. Every value on
the wire is text, so there is nothing to send that a string schema must refuse,
and that cell is empty by definition rather than by omission. Every other empty
cell is a case nobody has written.

## Content representation surface

The table above enumerates style serialization, and a parameter declaring
`content` has no style and no explode to place in it. Those cases were in the
corpus and in no coverage map. This is their map.

Defined combinations: 24. Covered: 4. Empty: 20.

Mostly empty, and published that way. The corpus has 6 content cases and this
surface has room for far more, so this table keeps the empty cells visible.
Filling it to look full would make the coverage number less informative.

No legality filter applies, unlike the style table. The Style Values table marks
some style, location and type combinations n/a; `content` has no such table, is
permitted in all four locations, and is not restricted by schema shape. So every
empty cell here is a case nobody has written, and none of them is a combination
the specification excludes.

`condition` is the axis a style surface has no room for. A media type
representation can be a value that is not a representation of it, and what a
library does with that is a different question from what it does with a
well-formed one. A case carrying `foreignWireShape` fills a `malformed` cell.

Media types enumerated: `application/json`. That is what the corpus
declares. A library's handling of `application/xml` or `text/plain` is unmeasured
here rather than absent, and widening the axis means writing cases that send
them.

| location | media type | schema | condition | covered |
| --- | --- | --- | --- | --- |
| cookie | application/json | array | malformed |  |
| cookie | application/json | array | wellFormed |  |
| cookie | application/json | object | malformed |  |
| cookie | application/json | object | wellFormed |  |
| cookie | application/json | scalar | malformed |  |
| cookie | application/json | scalar | wellFormed |  |
| header | application/json | array | malformed |  |
| header | application/json | array | wellFormed |  |
| header | application/json | object | malformed |  |
| header | application/json | object | wellFormed | yes |
| header | application/json | scalar | malformed |  |
| header | application/json | scalar | wellFormed |  |
| path | application/json | array | malformed |  |
| path | application/json | array | wellFormed |  |
| path | application/json | object | malformed |  |
| path | application/json | object | wellFormed | yes |
| path | application/json | scalar | malformed |  |
| path | application/json | scalar | wellFormed |  |
| query | application/json | array | malformed |  |
| query | application/json | array | wellFormed |  |
| query | application/json | object | malformed | yes |
| query | application/json | object | wellFormed | yes |
| query | application/json | scalar | malformed |  |
| query | application/json | scalar | wellFormed |  |

A case that breaks a rule addressed to whoever wrote the document fills no cell
here, and 2 content cases are excluded on that rule: `query-content-and-schema-declared-oas31`, `query-content-two-media-types-oas31`. They vary the
declaration rather than the representation, so counting them would mark a
representation covered that nothing has sent. They appear in `matrix.oas31.md`.

Every remaining content case lands in a cell above.

## Specification sections exercised

Case ids name the surface under probe, such as location, style, schema shape
and what the case varies. They do not name the specification section, which
lives in the citation. This index reads the other way, from section to cases,
so a reader starting at a paragraph of the specification can find every case
resting on it, and can see which cited sections carry only one.

| section | cases |
| --- | --- |
| appendix-b-data-type-conversion | `path-matrix-scalar-wrong-type-oas31`, `path-simple-scalar-wrong-type-oas31`, `query-form-array-integer-items-oas31`, `query-form-boolean-literal-oas31`, `query-form-boolean-wrong-type-oas31`, `query-form-object-integer-properties-oas31`, `query-form-object-wrong-type-oas31`, `query-form-scalar-integer-fractional-oas31`, `query-form-scalar-integer-oas31`, `query-form-scalar-nullable-absent-oas31`, `query-form-scalar-nullable-empty-oas31`, `query-form-scalar-nullable-literal-oas31` |
| appendix-d-serializing-headers-and-cookies | `cookie-form-array-canonical-no-explode-oas31`, `cookie-form-object-canonical-oas31`, `cookie-form-scalar-canonical-oas31`, `cookie-form-scalar-explode-oas31` |
| decoding-uris-and-form-urlencoded-strings | `path-content-json-object-canonical-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31` |
| fixed-fields-for-use-with-content | `header-content-json-object-canonical-oas31`, `path-content-json-object-canonical-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31` |
| media-type-object | `header-content-json-object-canonical-oas31`, `path-content-json-object-canonical-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31` |
| parameter-allow-empty-value | `query-form-scalar-allow-empty-value-declared-oas31` |
| parameter-allow-reserved | `query-form-scalar-allow-reserved-declared-oas31`, `query-form-scalar-allow-reserved-percent-triple-oas31`, `query-form-scalar-allow-reserved-unset-oas31` |
| parameter-content | `header-content-json-object-canonical-oas31`, `path-content-json-object-canonical-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31`, `query-content-two-media-types-oas31` |
| parameter-explode | `query-deep-object-no-explode-oas31`, `query-form-array-canonical-explode-oas31`, `query-form-array-canonical-no-explode-oas31`, `query-form-array-unset-style-oas31`, `query-form-object-canonical-explode-oas31`, `query-form-object-canonical-no-explode-oas31`, `query-form-object-missing-name-oas31` |
| parameter-locations | `header-simple-array-case-variant-oas31` |
| parameter-name | `path-matrix-array-empty-after-parse-oas31`, `path-matrix-competing-parameters-oas31`, `path-matrix-scalar-foreign-name-oas31`, `query-form-scalar-missing-name-oas31` |
| parameter-required | `path-label-array-foreign-shape-oas31`, `path-matrix-array-empty-after-parse-oas31`, `path-matrix-array-foreign-shape-oas31`, `path-matrix-competing-parameters-oas31`, `path-matrix-scalar-foreign-name-oas31`, `path-routing-concrete-before-templated-oas31`, `query-form-object-missing-name-oas31`, `query-form-scalar-missing-name-oas31`, `query-form-scalar-optional-absent-oas31`, `query-form-scalar-optional-default-absent-oas31` |
| parameter-schema | `path-matrix-scalar-wrong-type-oas31`, `path-simple-scalar-wrong-type-oas31` |
| parameter-style | `header-simple-array-canonical-oas31`, `header-simple-array-case-variant-oas31`, `header-simple-array-explicit-style-oas31`, `header-simple-array-explode-oas31`, `header-simple-object-canonical-oas31`, `header-simple-object-explode-oas31`, `header-simple-scalar-canonical-oas31`, `header-simple-scalar-explode-oas31`, `path-label-array-canonical-oas31`, `path-label-array-explode-oas31`, `path-label-array-foreign-shape-oas31`, `path-label-object-canonical-oas31`, `path-label-object-explode-oas31`, `path-label-scalar-canonical-oas31`, `path-label-scalar-explode-oas31`, `path-matrix-array-canonical-oas31`, `path-matrix-array-empty-after-parse-oas31`, `path-matrix-array-foreign-shape-oas31`, `path-matrix-array-no-explode-oas31`, `path-matrix-competing-parameters-oas31`, `path-matrix-object-canonical-oas31`, `path-matrix-object-explode-oas31`, `path-matrix-scalar-canonical-oas31`, `path-matrix-scalar-explode-oas31`, `path-matrix-scalar-foreign-name-oas31`, `path-matrix-scalar-wrong-type-oas31`, `path-simple-array-canonical-oas31`, `path-simple-array-explode-oas31`, `path-simple-object-canonical-oas31`, `path-simple-object-explode-oas31`, `path-simple-scalar-canonical-oas31`, `path-simple-scalar-explode-oas31`, `path-simple-scalar-unset-style-oas31`, `query-deep-object-canonical-oas31`, `query-form-array-canonical-explode-oas31`, `query-form-array-canonical-no-explode-oas31`, `query-form-array-unset-style-oas31`, `query-form-boolean-wrong-type-oas31`, `query-form-object-canonical-explode-oas31`, `query-form-object-canonical-no-explode-oas31`, `query-form-object-missing-name-oas31`, `query-form-object-wrong-type-oas31`, `query-form-scalar-allow-reserved-declared-oas31`, `query-form-scalar-missing-name-oas31`, `query-form-scalar-nullable-empty-oas31`, `query-form-scalar-nullable-literal-oas31`, `query-form-scalar-optional-absent-oas31`, `query-form-scalar-optional-default-absent-oas31`, `query-form-scalar-unset-style-oas31`, `query-pipe-delimited-array-canonical-oas31`, `query-pipe-delimited-object-canonical-oas31`, `query-space-delimited-array-canonical-oas31`, `query-space-delimited-object-canonical-oas31` |
| path-templating | `path-matrix-competing-parameters-oas31` |
| path-templating-matching | `path-routing-concrete-before-templated-oas31`, `path-routing-identical-templates-oas31` |
| paths-path | `path-routing-ambiguous-templates-oas31`, `path-routing-concrete-before-templated-oas31` |
| schema-object | `header-content-json-object-canonical-oas31`, `path-content-json-object-canonical-oas31`, `path-matrix-scalar-wrong-type-oas31`, `path-simple-scalar-wrong-type-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31`, `query-form-boolean-wrong-type-oas31`, `query-form-object-wrong-type-oas31`, `query-form-scalar-allow-reserved-declared-oas31`, `query-form-scalar-optional-default-absent-oas31` |
| style-examples | `cookie-form-array-explode-oas31`, `cookie-form-object-explode-oas31`, `header-simple-array-canonical-oas31`, `header-simple-array-case-variant-oas31`, `header-simple-array-explicit-style-oas31`, `header-simple-array-explode-oas31`, `header-simple-object-canonical-oas31`, `header-simple-object-explode-oas31`, `header-simple-scalar-canonical-oas31`, `header-simple-scalar-explode-oas31`, `path-label-array-canonical-oas31`, `path-label-array-explode-oas31`, `path-label-array-foreign-shape-oas31`, `path-label-object-canonical-oas31`, `path-label-object-explode-oas31`, `path-label-scalar-canonical-oas31`, `path-label-scalar-explode-oas31`, `path-matrix-array-canonical-oas31`, `path-matrix-array-empty-after-parse-oas31`, `path-matrix-array-foreign-shape-oas31`, `path-matrix-array-no-explode-oas31`, `path-matrix-competing-parameters-oas31`, `path-matrix-object-canonical-oas31`, `path-matrix-object-explode-oas31`, `path-matrix-scalar-canonical-oas31`, `path-matrix-scalar-explode-oas31`, `path-matrix-scalar-foreign-name-oas31`, `path-matrix-scalar-wrong-type-oas31`, `path-simple-array-canonical-oas31`, `path-simple-array-explode-oas31`, `path-simple-object-canonical-oas31`, `path-simple-object-explode-oas31`, `path-simple-scalar-canonical-oas31`, `path-simple-scalar-explode-oas31`, `path-simple-scalar-unset-style-oas31`, `query-deep-object-canonical-oas31`, `query-form-array-canonical-explode-oas31`, `query-form-array-canonical-no-explode-oas31`, `query-form-array-empty-value-oas31`, `query-form-array-unset-style-oas31`, `query-form-object-canonical-explode-oas31`, `query-form-object-canonical-no-explode-oas31`, `query-form-scalar-nullable-empty-oas31`, `query-form-scalar-nullable-empty-oas31`, `query-form-scalar-nullable-literal-oas31`, `query-form-scalar-unset-style-oas31`, `query-pipe-delimited-array-canonical-oas31`, `query-pipe-delimited-object-canonical-oas31`, `query-space-delimited-array-canonical-oas31`, `query-space-delimited-array-explode-oas31`, `query-space-delimited-object-canonical-oas31` |
| x4-8-12-2-fixed-fields | `header-content-json-object-canonical-oas31`, `path-content-json-object-canonical-oas31`, `query-content-and-schema-declared-oas31`, `query-content-json-object-canonical-oas31`, `query-content-json-object-malformed-oas31` |

Cases resting on no cited section, because the specification is silent: `header-simple-array-duplicate-name-oas31`, `path-simple-array-encoded-delimiter-oas31`, `query-form-array-duplicate-name-oas31`.

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
| cookie | yes | 4 of 4 | 4 |
| cookie | no | 1 of 2 | 2 |
| header | yes | 6 of 6 | 6 |
| header | no | 0 of 3 | 3 |
| path | yes | 29 of 29 | 29 |
| path | no | 0 of 1 | 1 |
| query | yes | 24 of 24 | 24 |
| query | no | 0 of 9 | 9 |

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
| canonical | 48 |
| caseVariant | 1 |
| competingParameter | 4 |
| competingPath | 3 |
| declarationFlag | 4 |
| duplicateName | 2 |
| emptyAfterParse | 1 |
| emptyContainer | 2 |
| encodingVariant | 2 |
| foreignName | 1 |
| foreignWireShape | 5 |
| missingName | 3 |
| optionalAbsent | 2 |
| wrongTypeValue | 6 |

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
| routing | 1 | 2 |
| splitting | 1 | 6 |
| styleDeserialization | 44 | 15 |
| contentDeserialization | 4 | 0 |
| schemaValidation | 9 | 2 |

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
