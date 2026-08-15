/** A value that survives a round trip through JSON, which is what stored raw output must be. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
