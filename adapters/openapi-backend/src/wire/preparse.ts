/**
 * The split the harness performed, per location.
 *
 * `null` for a location means the harness supplied nothing there because the
 * library recovers those values itself.
 */
export interface PreparsedRequest {
  readonly params: Record<string, string> | null;
  readonly query: ReadonlyArray<readonly [name: string, value: string | null]> | null;
  readonly headers: Record<string, string | string[]> | null;
  readonly cookies: ReadonlyArray<readonly [name: string, value: string | null]> | null;
}
