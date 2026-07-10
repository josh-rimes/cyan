/**
 * A structured, successfully-parsed @namespace-name(...) call.
 */
export interface AnnotationCall {
  namespace: string;
  name: string;
  params: Record<string, string>;
  location: AnnotationLocation;
}

/**
 * Enough information to re-find the exact sequence item later
 * (for --explain output and for in-place mutation during build),
 * without holding onto a live AST node.
 */
export interface AnnotationLocation {
  /** 1-based line number of the sequence item, for human-facing messages. */
  line: number;
  /** 1-based column number of the sequence item. */
  col: number;
  /**
   * Path from the document root to this sequence item, in the form
   * the 'yaml' package's getIn/setIn expects: a mix of string keys
   * (mapping keys, e.g. "script") and numeric indices (sequence
   * positions). Example: ["build", "script", 2] means:
   * doc.get("build").get("script").get(2)
   */
  path: (string | number)[];
}

/**
 * A structured parse failure. Never silently coerce - every failure
 * must say specifically what was expected and where.
 */
export interface AnnotationParseError {
  kind:
    | "malformed-call-syntax"
    | "malformed-parameter-list"
    | "unquoted-value"
    | "trailing-comma"
    | "unterminated-string";
  message: string;
  location: AnnotationLocation;
  /** The raw scalar string that failed to parse, for error display. */
  raw: string;
}

export type AnnotationParseResult =
  | { ok: true; value: AnnotationCall }
  | { ok: false; error: AnnotationParseError };
