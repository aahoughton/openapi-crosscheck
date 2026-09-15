import type { Citation } from "../../types/case";
import type { OasVersion } from "../../types/openapi";

/** RFC rules applied to cases of the given OpenAPI version. */
export function rfcCitations(oasVersion: OasVersion) {
  function cite(rfc: number, section: string, quoted: string): Citation {
    const anchor = `section-${section}`;
    return {
      oasVersion,
      anchor,
      url: `https://www.rfc-editor.org/rfc/rfc${String(rfc)}.html#${anchor}`,
      quoted,
    };
  }
  return {
    URI_DECODE_SUBCOMPONENTS: cite(
      3986,
      "2.4",
      "When a URI is dereferenced, the components and subcomponents significant to the " +
        "scheme-specific dereferencing process (if any) must be parsed and separated " +
        "before the percent-encoded octets within those components can be safely decoded, " +
        "as otherwise the data may be mistaken for component delimiters.",
    ),
    SIMPLE_EXPANSION: cite(
      6570,
      "3.2.2",
      "For each defined variable in the variable-list, perform variable expansion, as " +
        "defined in Section 3.2.1, with the allowed characters being those in the " +
        "unreserved set.",
    ),
    LIST_EXPANSION: cite(
      6570,
      "3.2.1",
      "For a variable that is a list of values, expansion depends on both the expression " +
        "type and the presence of an explode modifier. If there is no explode modifier, " +
        "the expansion consists of a comma-separated concatenation of the defined member " +
        "string values.",
    ),
    HEADER_FIELD_ORDER: cite(
      7230,
      "3.2.2",
      "A recipient MAY combine multiple header fields with the same field name into one " +
        '"field-name: field-value" pair, without changing the semantics of the message, ' +
        "by appending each subsequent field value to the combined field value in order, " +
        "separated by a comma.",
    ),
  };
}
