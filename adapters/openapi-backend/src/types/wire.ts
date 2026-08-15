/**
 * A request as it appears on the wire, before anything has interpreted it.
 *
 * `target` stays a single unparsed string all the way through the corpus. The
 * moment a case stores a pre-split path and query, the harness has made the
 * deserialization decision that is under measurement.
 *
 * `headers` is a list of pairs rather than a record because duplicate names and
 * non-canonical casing are probe dimensions. A record silently collapses both,
 * which would destroy exactly the cases this corpus exists to run. Cookies
 * travel as a raw `Cookie` header for the same reason.
 */
export interface WireRequest {
  readonly method: string;
  /** Origin-form request target, unparsed: `/t/;p=1;p=2?a=b`. */
  readonly target: string;
  readonly headers: ReadonlyArray<readonly [name: string, value: string]>;
}
