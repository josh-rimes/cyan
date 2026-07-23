import type { Snippet } from "../snippets/types.js";
import type {
  AnnotationCall,
  AnnotationLocation,
} from "../annotation/types.js";

export interface MissingRequiredParamError {
  kind: "missing-required-param";
  namespace: string;
  name: string;
  parameter: string;
  location: AnnotationLocation;
  message: string;
}

export interface UnknownParamError {
  kind: "unknown-param";
  namespace: string;
  name: string;
  parameter: string;
  location: AnnotationLocation;
  message: string;
}

export type ParamValidationError =
  | MissingRequiredParamError
  | UnknownParamError;

export type ResolvedParams = Record<string, string>;

export type ParamValidateResult =
  | { ok: true; value: ResolvedParams }
  | { ok: false; errors: ParamValidationError[] };

/**
 * Validates an annotation call's supplied params against a snippet's
 * parameter schema, and resolves final values (supplied value, or
 * default when not supplied). Error-accumulating: collects every problem in one pass rather than failing on the first.
 */
export function validateParams(
  call: AnnotationCall,
  snippet: Snippet,
): ParamValidateResult {
  const errors: ParamValidationError[] = [];
  const resolved: ResolvedParams = {};

  // Check supplied params against schema (catches unknowns)
  for (const suppliedName of Object.keys(call.params)) {
    if (!(suppliedName in snippet.parameters)) {
      errors.push({
        kind: "unknown-param",
        namespace: snippet.namespace,
        name: snippet.name,
        parameter: suppliedName,
        location: call.location,
        message: `Unknown parameter "${suppliedName}" for snippet "${snippet.namespace}-${snippet.name}"`,
      });
    }
  }

  // Walk schema params, resolve or flag missing-required
  for (const [paramName, def] of Object.entries(snippet.parameters)) {
    const supplied = call.params[paramName];

    if (supplied !== undefined) {
      resolved[paramName] = supplied;
    } else if (def.default !== undefined) {
      resolved[paramName] = def.default;
    } else if (def.required) {
      errors.push({
        kind: "missing-required-param",
        namespace: snippet.namespace,
        name: snippet.name,
        parameter: paramName,
        location: call.location,
        message: `Missing required parameter "${paramName}" for snippet "${snippet.namespace}-${snippet.name}"`,
      });
    }
    // not required, not supplied, no default -> simply absent from resolved
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: resolved };
}
