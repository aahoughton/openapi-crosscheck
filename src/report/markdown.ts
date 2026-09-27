/**
 * Text made safe to sit inside one markdown table cell.
 *
 * GitHub-flavored markdown splits a row on every unescaped `|`, including one
 * inside a code span, so a library value carrying a pipe would otherwise spill
 * across columns. A line break ends the row, so whitespace runs collapse to one
 * space. Nothing else is changed: the cell still says exactly what was recorded.
 */
export function tableCell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "\\|");
}
