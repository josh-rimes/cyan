import type { ResolvedParams } from "./validate-params.js";
import type { AnnotationLocation } from "../annotation/types.js";

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export interface UnresolvedPlaceholderError {
  kind: "unresolved-placeholder";
  namespace: string;
  name: string;
  parameter: string;
  lineIndex: number;
  location: AnnotationLocation;
  message: string;
}

export type InterpolateResult =
  | { ok: true; value: string[] }
  | { ok: false; errors: UnresolvedPlaceholderError[] };

/**
 * Substitutes {{param}} placeholders in a snippet's script line using
 * already-resolved param values. $VAR / ${VAR}-style GitLab native
 * variables are untouched because the pattern only ever matches {{ }}.
 * Error-accumulating across all lines, not fail-fast on the first.
 */
export function interpolateScript(
  script: string[],
  resolvedParams: ResolvedParams,
  namespace: string,
  name: string,
  location: AnnotationLocation,
): InterpolateResult {
  const errors: UnresolvedPlaceholderError[] = [];
  const resolvedLines: string[] = [];

  script.forEach((line, lineIndex) => {
    const output = line.replace(
      PLACEHOLDER_PATTERN,
      (_match, paramName: string) => {
        if (paramName in resolvedParams) {
          return resolvedParams[paramName];
        }
        errors.push({
          kind: "unresolved-placeholder",
          namespace,
          name,
          parameter: paramName,
          lineIndex,
          location,
          message: `Unresolved placeholder "{{${paramName}}}" in snippet "${namespace}-${name}" (script line ${lineIndex}): no value supplied, no default, and not required`,
        });
        return _match; // leave placeholder text as-is in the (discarded) result; error is what matters
      },
    );

    resolvedLines.push(output);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: resolvedLines };
}
