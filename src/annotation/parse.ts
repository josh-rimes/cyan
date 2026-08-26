import type {
  AnnotationCall,
  AnnotationParseResult,
  AnnotationParseError,
  AnnotationLocation,
} from "./types.js";
import type { AnnotationCandidate } from "./detect.js";

type ParamsParseResult =
  | { ok: true; value: Record<string, string> }
  | { ok: false; error: AnnotationParseError };

const CALL_SHAPE = /^@([A-Za-z][A-Za-z0-9_-]*)\((.*)\)$/s;

function err(
  kind: AnnotationParseError["kind"],
  message: string,
  location: AnnotationLocation,
  raw: string,
): { ok: false; error: AnnotationParseError } {
  return { ok: false, error: { kind, message, location, raw } };
}

export function parseAnnotation(
  candidate: AnnotationCandidate,
): AnnotationParseResult {
  const { raw, location } = candidate;

  const shapeMatch = CALL_SHAPE.exec(raw);

  if (!shapeMatch) {
    return err(
      "malformed-call-syntax",
      `Expected "namespace-name(params)" but could not parse call shape in: ${raw}`,
      location,
      raw,
    );
  }

  const [, identifier, paramsBody] = shapeMatch;

  const hyphenIdx = identifier.indexOf("-");

  if (hyphenIdx === -1) {
    return err(
      "malformed-call-syntax",
      `Expected "namespace-name" (hyphenated) but got "${identifier}" with no namespace separator`,
      location,
      raw,
    );
  }
  const namespace = identifier.slice(0, hyphenIdx);
  const name = identifier.slice(hyphenIdx + 1);

  const paramsResult = parseParams(paramsBody, location, raw);

  if (!paramsResult.ok) {
    return paramsResult;
  }

  return {
    ok: true,
    value: { namespace, name, params: paramsResult.value, location },
  };
}

function parseParams(
  body: string,
  location: AnnotationLocation,
  raw: string,
): ParamsParseResult {
  const params: Record<string, string> = {};
  let i = 0;
  const len = body.length;

  const skipWs = () => {
    while (i < len && /\s/.test(body[i])) i++;
  };

  skipWs();
  if (i === len) {
    // Empty parens (or whitespace-only) => zero params, valid.
    return { ok: true, value: params };
  }

  while (true) {
    skipWs();

    // key
    const keyStart = i;
    while (i < len && /[A-Za-z0-9_]/.test(body[i])) i++;
    if (i === keyStart) {
      return err(
        "malformed-parameter-list",
        `Expected a parameter name at position ${i} in params, got: "${body.slice(i, i + 10)}"`,
        location,
        raw,
      );
    }
    const key = body.slice(keyStart, i);

    skipWs();

    // colon
    if (body[i] !== ":") {
      return err(
        "malformed-parameter-list",
        `Expected ":" after parameter "${key}" but found "${body[i] ?? "end of input"}"`,
        location,
        raw,
      );
    }
    i++;

    skipWs();

    // quoted value
    if (body[i] !== '"') {
      return err(
        "unquoted-value",
        `Expected a double-quoted string value for parameter "${key}" but found "${body[i] ?? "end of input"}"`,
        location,
        raw,
      );
    }
    i++; // consume opening quote

    const valueStart = i;

    while (i < len && body[i] !== '"') i++;

    if (i === len) {
      return err(
        "unterminated-string",
        `Unterminated string value for parameter "${key}" (missing closing quote)`,
        location,
        raw,
      );
    }

    const value = body.slice(valueStart, i);

    i++; // consume closing quote

    params[key] = value;

    skipWs();

    if (i === len) {
      // Clean end after a value - done.
      break;
    }
    if (body[i] !== ",") {
      return err(
        "malformed-parameter-list",
        `Expected "," or end of parameter list after "${key}" but found "${body[i]}"`,
        location,
        raw,
      );
    }
    i++; // consume comma

    skipWs();

    if (i === len) {
      return err(
        "trailing-comma",
        `Trailing comma after last parameter "${key}" is not allowed`,
        location,
        raw,
      );
    }
  }

  return { ok: true, value: params };
}
