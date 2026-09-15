# Coverage, OpenAPI 3.0

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
| `boolean` | 4 | `query-content-json-boolean-wrong-type-oas30`, `query-form-boolean-wrong-type-oas30` |
| `integer` | 8 | `path-matrix-scalar-wrong-type-oas30`, `path-simple-scalar-wrong-type-oas30`, `query-form-object-wrong-type-oas30`, `query-form-scalar-integer-fractional-oas30` |
| `null` | 1 |  |
| `number` | 0 |  |
| `string` | 86 | `query-form-object-wrong-type-oas30`, `query-form-scalar-nullable-literal-oas30` |

A wrong-typed value against `string` cannot be constructed here. Every value on
the wire is text, so there is nothing to send that a string schema must refuse,
and that cell is empty by definition rather than by omission. Every other empty
cell is a case nobody has written.

## Content representation surface

The table above enumerates style serialization, and a parameter declaring
`content` has no style and no explode to place in it. Those cases were in the
corpus and in no coverage map. This is their map.

Defined combinations: 48. Covered: 5. Empty: 43.

Mostly empty, and published that way. The corpus has 8 content cases and this
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
| header | application/json | object | wellFormed | yes |
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
| path | application/json | object | wellFormed | yes |
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
| query | application/json | object | malformed | yes |
| query | application/json | object | wellFormed | yes |
| query | application/json | scalar | malformed |  |
| query | application/json | scalar | wellFormed | yes |
| query | application/x-www-form-urlencoded | array | malformed |  |
| query | application/x-www-form-urlencoded | array | wellFormed |  |
| query | application/x-www-form-urlencoded | object | malformed |  |
| query | application/x-www-form-urlencoded | object | wellFormed |  |
| query | application/x-www-form-urlencoded | scalar | malformed |  |
| query | application/x-www-form-urlencoded | scalar | wellFormed |  |

A case that breaks a rule addressed to whoever wrote the document fills no cell
here, and 2 content cases are excluded on that rule: `query-content-and-schema-declared-oas30`, `query-content-two-media-types-oas30`. They vary the
declaration rather than the representation, so counting them would mark a
representation covered that nothing has sent. They appear in `matrix.oas30.md`.

Every remaining content case lands in a cell above.

## Specification sections exercised

Case ids name the surface under probe, such as location, style, schema shape
and what the case varies. They do not name the specification section, which
lives in the citation. This index reads the other way, from section to cases,
so a reader starting at a paragraph of the specification can find every case
resting on it, and can see which cited sections carry only one.

| section | cases |
| --- | --- |
| appendix-b-data-type-conversion | `path-matrix-scalar-wrong-type-oas30`, `path-simple-scalar-wrong-type-oas30`, `query-form-array-integer-items-oas30`, `query-form-boolean-literal-oas30`, `query-form-boolean-wrong-type-oas30`, `query-form-object-integer-properties-oas30`, `query-form-object-wrong-type-oas30`, `query-form-scalar-integer-fractional-oas30`, `query-form-scalar-integer-oas30`, `query-form-scalar-nullable-absent-oas30`, `query-form-scalar-nullable-empty-oas30`, `query-form-scalar-nullable-literal-oas30` |
| appendix-d-serializing-headers-and-cookies | `cookie-form-array-canonical-no-explode-oas30`, `cookie-form-object-canonical-oas30`, `cookie-form-scalar-canonical-oas30`, `cookie-form-scalar-explode-oas30` |
| decoding-uris-and-form-urlencoded-strings | `path-content-json-object-canonical-oas30`, `query-content-json-boolean-canonical-oas30`, `query-content-json-boolean-wrong-type-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30`, `query-form-scalar-encoded-plus-oas30`, `query-form-scalar-encoded-plus-oas30`, `query-form-scalar-unencoded-plus-oas30` |
| fixed-fields-for-use-with-content | `header-content-json-object-canonical-oas30`, `path-content-json-object-canonical-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30` |
| json-schema-keywords | `query-form-scalar-optional-default-absent-oas30`, `query-form-scalar-pattern-mismatch-oas30`, `query-form-scalar-type-array-oas30` |
| media-type-object | `header-content-json-object-canonical-oas30`, `path-content-json-object-canonical-oas30`, `query-content-json-boolean-canonical-oas30`, `query-content-json-boolean-wrong-type-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30` |
| parameter-allow-empty-value | `query-form-scalar-allow-empty-value-declared-oas30` |
| parameter-allow-reserved | `query-form-scalar-allow-reserved-declared-oas30`, `query-form-scalar-allow-reserved-percent-triple-oas30`, `query-form-scalar-allow-reserved-unset-oas30` |
| parameter-content | `header-content-json-object-canonical-oas30`, `path-content-json-object-canonical-oas30`, `query-content-json-boolean-canonical-oas30`, `query-content-json-boolean-wrong-type-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30`, `query-content-two-media-types-oas30` |
| parameter-explode | `query-deep-object-no-explode-oas30`, `query-form-array-canonical-explode-oas30`, `query-form-array-canonical-no-explode-oas30`, `query-form-array-unset-style-oas30`, `query-form-object-canonical-explode-oas30`, `query-form-object-canonical-no-explode-oas30`, `query-form-object-missing-name-oas30` |
| parameter-locations | `header-simple-array-case-variant-oas30`, `header-simple-array-duplicate-name-oas30` |
| parameter-name | `header-reserved-name-accept-present-wrong-type-oas30`, `header-reserved-name-accept-required-absent-oas30`, `path-matrix-array-empty-after-parse-oas30`, `path-matrix-competing-parameters-oas30`, `path-matrix-scalar-foreign-name-oas30`, `query-form-scalar-missing-name-oas30` |
| parameter-required | `header-reserved-name-accept-required-absent-oas30`, `path-label-array-foreign-shape-oas30`, `path-matrix-array-empty-after-parse-oas30`, `path-matrix-array-foreign-shape-oas30`, `path-matrix-competing-parameters-oas30`, `path-matrix-scalar-foreign-name-oas30`, `path-routing-concrete-before-templated-oas30`, `path-routing-concrete-before-templated-template-first-oas30`, `path-routing-concrete-before-templated-template-first-valid-oas30`, `path-routing-concrete-before-templated-valid-oas30`, `path-simple-scalar-required-false-oas30`, `query-form-object-missing-name-oas30`, `query-form-scalar-missing-name-oas30`, `query-form-scalar-optional-absent-oas30`, `query-form-scalar-optional-default-absent-oas30` |
| parameter-schema | `path-matrix-scalar-wrong-type-oas30`, `path-simple-scalar-wrong-type-oas30` |
| parameter-style | `header-simple-array-canonical-oas30`, `header-simple-array-case-variant-oas30`, `header-simple-array-duplicate-name-oas30`, `header-simple-array-explicit-style-oas30`, `header-simple-array-explode-oas30`, `header-simple-object-canonical-oas30`, `header-simple-object-explode-oas30`, `header-simple-scalar-canonical-oas30`, `header-simple-scalar-explode-oas30`, `path-label-array-canonical-oas30`, `path-label-array-explode-oas30`, `path-label-array-foreign-shape-oas30`, `path-label-object-canonical-oas30`, `path-label-object-explode-oas30`, `path-label-scalar-canonical-oas30`, `path-label-scalar-explode-oas30`, `path-matrix-array-canonical-oas30`, `path-matrix-array-empty-after-parse-oas30`, `path-matrix-array-foreign-shape-oas30`, `path-matrix-array-no-explode-oas30`, `path-matrix-competing-parameters-oas30`, `path-matrix-object-canonical-oas30`, `path-matrix-object-explode-oas30`, `path-matrix-scalar-canonical-oas30`, `path-matrix-scalar-explode-oas30`, `path-matrix-scalar-foreign-name-oas30`, `path-matrix-scalar-wrong-type-oas30`, `path-simple-array-canonical-oas30`, `path-simple-array-encoded-delimiter-oas30`, `path-simple-array-explode-oas30`, `path-simple-object-canonical-oas30`, `path-simple-object-explode-oas30`, `path-simple-scalar-canonical-oas30`, `path-simple-scalar-explode-oas30`, `path-simple-scalar-unset-style-oas30`, `query-deep-object-canonical-oas30`, `query-form-array-canonical-explode-oas30`, `query-form-array-canonical-no-explode-oas30`, `query-form-array-unset-style-oas30`, `query-form-object-canonical-explode-oas30`, `query-form-object-canonical-no-explode-oas30`, `query-form-object-missing-name-oas30`, `query-form-object-wrong-type-oas30`, `query-form-scalar-allow-reserved-declared-oas30`, `query-form-scalar-encoded-plus-oas30`, `query-form-scalar-missing-name-oas30`, `query-form-scalar-nullable-empty-oas30`, `query-form-scalar-nullable-literal-oas30`, `query-form-scalar-optional-absent-oas30`, `query-form-scalar-optional-default-absent-oas30`, `query-form-scalar-pattern-mismatch-oas30`, `query-form-scalar-unset-style-oas30`, `query-pipe-delimited-array-canonical-oas30`, `query-pipe-delimited-object-canonical-oas30`, `query-space-delimited-array-canonical-oas30`, `query-space-delimited-object-canonical-oas30` |
| path-templating | `path-matrix-competing-parameters-oas30` |
| path-templating-matching | `path-routing-concrete-before-templated-oas30`, `path-routing-concrete-before-templated-template-first-oas30`, `path-routing-concrete-before-templated-template-first-valid-oas30`, `path-routing-concrete-before-templated-valid-oas30`, `path-routing-identical-templates-oas30` |
| paths-path | `path-routing-ambiguous-templates-oas30`, `path-routing-concrete-before-templated-oas30`, `path-routing-concrete-before-templated-template-first-oas30`, `path-routing-concrete-before-templated-template-first-valid-oas30`, `path-routing-concrete-before-templated-valid-oas30` |
| schema-nullable | `query-form-scalar-nullable-empty-oas30`, `query-form-scalar-nullable-literal-oas30` |
| schema-object | `header-content-json-object-canonical-oas30`, `header-reserved-name-accept-present-wrong-type-oas30`, `path-content-json-object-canonical-oas30`, `path-matrix-scalar-wrong-type-oas30`, `path-simple-scalar-wrong-type-oas30`, `query-content-json-boolean-canonical-oas30`, `query-content-json-boolean-wrong-type-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30`, `query-form-object-wrong-type-oas30`, `query-form-scalar-allow-reserved-declared-oas30`, `query-form-scalar-encoded-plus-oas30`, `query-form-scalar-pattern-mismatch-oas30` |
| section-2.4 | `path-simple-array-encoded-delimiter-oas30` |
| section-3.2.1 | `path-simple-array-encoded-delimiter-oas30` |
| section-3.2.2 | `header-simple-array-duplicate-name-oas30`, `path-simple-array-encoded-delimiter-oas30` |
| style-examples | `cookie-form-array-explode-oas30`, `cookie-form-object-explode-oas30`, `header-simple-array-canonical-oas30`, `header-simple-array-case-variant-oas30`, `header-simple-array-duplicate-name-oas30`, `header-simple-array-explicit-style-oas30`, `header-simple-array-explode-oas30`, `header-simple-object-canonical-oas30`, `header-simple-object-explode-oas30`, `header-simple-scalar-canonical-oas30`, `header-simple-scalar-explode-oas30`, `path-label-array-canonical-oas30`, `path-label-array-explode-oas30`, `path-label-array-foreign-shape-oas30`, `path-label-object-canonical-oas30`, `path-label-object-explode-oas30`, `path-label-scalar-canonical-oas30`, `path-label-scalar-explode-oas30`, `path-matrix-array-canonical-oas30`, `path-matrix-array-empty-after-parse-oas30`, `path-matrix-array-foreign-shape-oas30`, `path-matrix-array-no-explode-oas30`, `path-matrix-competing-parameters-oas30`, `path-matrix-object-canonical-oas30`, `path-matrix-object-explode-oas30`, `path-matrix-scalar-canonical-oas30`, `path-matrix-scalar-explode-oas30`, `path-matrix-scalar-foreign-name-oas30`, `path-matrix-scalar-wrong-type-oas30`, `path-simple-array-canonical-oas30`, `path-simple-array-explode-oas30`, `path-simple-object-canonical-oas30`, `path-simple-object-explode-oas30`, `path-simple-scalar-canonical-oas30`, `path-simple-scalar-explode-oas30`, `path-simple-scalar-unset-style-oas30`, `query-deep-object-canonical-oas30`, `query-form-array-canonical-explode-oas30`, `query-form-array-canonical-no-explode-oas30`, `query-form-array-empty-value-oas30`, `query-form-array-unset-style-oas30`, `query-form-object-canonical-explode-oas30`, `query-form-object-canonical-no-explode-oas30`, `query-form-scalar-name-without-value-oas30`, `query-form-scalar-nullable-empty-oas30`, `query-form-scalar-nullable-empty-oas30`, `query-form-scalar-nullable-literal-oas30`, `query-form-scalar-unset-style-oas30`, `query-pipe-delimited-array-canonical-oas30`, `query-pipe-delimited-object-canonical-oas30`, `query-space-delimited-array-canonical-oas30`, `query-space-delimited-array-explode-oas30`, `query-space-delimited-object-canonical-oas30` |
| style-values | `path-simple-array-encoded-delimiter-oas30` |
| x4-7-12-2-fixed-fields | `header-content-json-object-canonical-oas30`, `path-content-json-object-canonical-oas30`, `query-content-and-schema-declared-oas30`, `query-content-json-object-canonical-oas30`, `query-content-json-object-malformed-oas30` |

Cases resting on no cited section, because the specification is silent: `query-form-array-duplicate-name-oas30`.

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
| header | yes | 6 of 8 | 8 |
| header | no | 0 of 3 | 3 |
| path | yes | 33 of 33 | 33 |
| path | no | 0 of 1 | 1 |
| query | yes | 27 of 27 | 27 |
| query | no | 0 of 11 | 11 |

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
| canonical | 49 |
| caseVariant | 1 |
| competingParameter | 4 |
| competingPath | 6 |
| constraintViolation | 1 |
| declarationFlag | 4 |
| documentRule | 2 |
| duplicateName | 2 |
| emptyAfterParse | 1 |
| emptyContainer | 2 |
| encodingVariant | 4 |
| foreignName | 1 |
| foreignWireShape | 5 |
| missingName | 3 |
| nameWithoutValue | 1 |
| optionalAbsent | 2 |
| reservedName | 2 |
| wrongTypeValue | 7 |

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
| routing | 4 | 2 |
| splitting | 2 | 4 |
| styleDeserialization | 46 | 17 |
| contentDeserialization | 5 | 0 |
| schemaValidation | 12 | 5 |

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

## Schema constraint keywords

Which constraint keywords of this version's schema dialect some case writes
against a parameter. Counted by the same walk as the vocabulary bullet below:
a keyword counts when it appears in a schema position, and an object under
`enum`, `const` or `default` is an instance whose property names are data.

The rows are the dialect's, and the dialects are different sets. 3.0's Schema
Object is an extended subset of JSON Schema Draft Wright-00: its section on
JSON Schema keywords lists what it takes and adjusts, additional JSON Schema
keywords are strictly unsupported, and `nullable` is its own assertion, so the
3.0 table has a `nullable` row and no `const` row. 3.1 and 3.2 Schema Objects
are supersets of JSON Schema Draft 2020-12, so their rows are 2020-12's
assertion and applicator vocabulary, `const` included and `nullable` not:
2020-12 reads an unknown keyword as an annotation. Where the dialects share a
spelling they can still differ in meaning: `exclusiveMinimum` and
`exclusiveMaximum` are booleans modifying `minimum` and `maximum` in 3.0 and
standalone numbers in 2020-12, so a row shared by name is a different
question per version. Annotations (`title`, `description`, `format`,
`default` and their siblings) have rows in neither dialect: they change no
verdict, the same reason the stage table has no `valueExposure` row.

A zero row is a case nobody has written.
[bowtie](https://github.com/bowtie-json-schema/bowtie) measures standalone
JSON Schema implementations against the official suites; a case here answers
the integration question, whether each exact OpenAPI library, version and
configuration applies the keyword after parameter deserialization. The zero
rows are that surface, unfilled.

| keyword | cases |
| --- | --- |
| additionalProperties | 0 |
| allOf | 0 |
| anyOf | 0 |
| enum | 0 |
| exclusiveMaximum | 0 |
| exclusiveMinimum | 0 |
| items | 26 |
| maxItems | 0 |
| maxLength | 0 |
| maxProperties | 0 |
| maximum | 0 |
| minItems | 0 |
| minLength | 0 |
| minProperties | 0 |
| minimum | 0 |
| multipleOf | 0 |
| not | 0 |
| nullable | 3 |
| oneOf | 0 |
| pattern | 1 |
| properties | 25 |
| required | 1 |
| type | 97 |
| uniqueItems | 0 |

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
- Document structure: every case document is `openapi`, `info` and `paths`,
  with one operation carrying a `parameters` list. No `servers`, no
  `components`, no `$ref`, and no path-item-level `parameters`. This one is
  held by the object model in `src/types/openapi.ts` rather than by habit,
  so a case reaching for any of it does not typecheck. Server URL
  resolution, reference resolution and the path-item override rules are
  real specification surface and none of them is measured here.
- Schema vocabulary: `default`, `items`, `nullable`, `pattern`, `properties`, `required`, `type`.
  Everything a schema position writes, keyword by keyword. Which of the
  dialect's constraint keywords these do and do not reach is the table under
  Schema constraint keywords above.
- Header parameter names held constant: `Authorization`, `Content-Type`.
  This version reserves each of these ([parameter-name](https://spec.openapis.org/oas/v3.0.4.html#parameter-name)):

  > If in is "header" and the name field is "Accept", "Content-Type" or "Authorization", the parameter definition SHALL be ignored.

  This version exercises `Accept`; the names above remain unasked.
