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
import { querystringCases32 } from "./cases/oas32/querystring";
import { queryCases32 } from "./cases/oas32/query";

/**
 * The corpus, in ASCII order of case id.
 *
 * Cases are grouped by location and OpenAPI version, then explicitly assembled
 * and sorted here. Each names what it varies and holds constant. Canonical
 * cases supply the ordinary inputs from which the other probes vary.
 *
 * Declarations use either `schema` with `style`, or `content` with a media type.
 * Nothing here names a library or depends on how many are measured.
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
  ...querystringCases32,
].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
