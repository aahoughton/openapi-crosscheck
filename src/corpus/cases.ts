import type { Case } from "../types/case";
import { cookieCases30 } from "./cases/oas30/cookie";
import { headerCases30 } from "./cases/oas30/header";
import { pathCases30 } from "./cases/oas30/path";
import { queryCases30 } from "./cases/oas30/query";
import { cookieCases } from "./cases/oas31/cookie";
import { headerCases } from "./cases/oas31/header";
import { pathCases } from "./cases/oas31/path";
import { queryCases } from "./cases/oas31/query";
import { cookieCases32 } from "./cases/oas32/cookie";
import { pathCases32 } from "./cases/oas32/path";
import { queryCases32 } from "./cases/oas32/query";

/**
 * The corpus, in ASCII order of case id.
 *
 * Two declaration forms appear here, because the specification defines two. Most
 * cases declare `schema` and are serialized by `style`; the `content` cases
 * declare a media type instead and no style applies to them at all. What those
 * hold constant is worth naming: one media type, application/json, and a value
 * that is a well-formed representation of it unless the case says otherwise.
 *
 * Every case names what it varies and what it holds constant, because the
 * constant is the blind spot. The canonical cases hold everything constant and
 * exist to be the thing the other axes vary away from.
 *
 * Nothing here names a library or knows how many exist.
 *
 * One file per location and OpenAPI version, assembled here and sorted by id.
 * A case's id ends with its version suffix, so the two versions of one
 * coordinate interleave and no file concatenation order can be the corpus
 * order on its own; the sort here produces the ASCII order the corpus is
 * required to be in, and `citation.test.ts` still checks that it is. The split
 * is for reading and editing: a case lands in a file of tens rather than of
 * thousands, and a change to one location is a diff a reader can hold in their
 * head.
 *
 * Assembled by name rather than by reading the directory. A glob would make the
 * corpus depend on filesystem order, which the digest and every column ordering
 * rest on being fixed, and would let a file go missing with nothing saying so.
 */
export const cases: readonly Case[] = [
  ...cookieCases30,
  ...cookieCases,
  ...cookieCases32,
  ...headerCases30,
  ...headerCases,
  ...pathCases30,
  ...pathCases,
  ...pathCases32,
  ...queryCases30,
  ...queryCases,
  ...queryCases32,
].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
