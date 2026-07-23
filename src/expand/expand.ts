import type {
  AnnotationCall,
  AnnotationLocation,
} from "../annotation/types.js";
import {
  resolveSnippet,
  type ResolveDirs,
  type ResolveError,
} from "./resolve.js";
import {
  validateParams,
  type ParamValidationError,
} from "./validate-params.js";
import {
  interpolateScript,
  type UnresolvedPlaceholderError,
} from "./interpolate.js";

export interface ExpansionSuccess {
  ok: true;
  location: AnnotationLocation;
  namespace: string;
  name: string;
  version: string;
  source: "local" | "bundled";
  resolvedLines: string[];
}

export type ExpandError =
  | ResolveError
  | ParamValidationError
  | UnresolvedPlaceholderError;

export interface ExpansionFailure {
  ok: false;
  location: AnnotationLocation;
  namespace: string;
  name: string;
  error: ExpandError[];
}

export type ExpandResult = ExpansionSuccess | ExpansionFailure;

/**
 * Resolves, validates, and interpolates a single annotation call.
 * Never throws; every failure mode is a structured ExpansionFailure.
 */
export function expandAnnotation(
  call: AnnotationCall,
  dirs: ResolveDirs,
): ExpandResult {
  const resolved = resolveSnippet(
    call.namespace,
    call.name,
    call.location,
    dirs,
  );

  if (!resolved.ok) {
    return {
      ok: false,
      location: call.location,
      namespace: call.namespace,
      name: call.name,
      error: [resolved.error],
    };
  }

  const { snippet, source } = resolved.value;

  const paramResult = validateParams(call, snippet);

  if (!paramResult.ok) {
    return {
      ok: false,
      location: call.location,
      namespace: call.namespace,
      name: call.name,
      error: paramResult.errors,
    };
  }

  const interpolated = interpolateScript(
    snippet.script,
    paramResult.value,
    call.namespace,
    call.name,
    call.location,
  );

  if (!interpolated.ok) {
    return {
      ok: false,
      location: call.location,
      namespace: call.namespace,
      name: call.name,
      error: interpolated.errors,
    };
  }

  return {
    ok: true,
    location: call.location,
    namespace: call.namespace,
    name: call.name,
    version: snippet.version,
    source,
    resolvedLines: interpolated.value,
  };
}

/**
 * Expands every annotation call independently. One failing annotation
 * never blocks resolution of the others.
 */
export function expandAnnotations(
  calls: AnnotationCall[],
  dirs: ResolveDirs,
): ExpandResult[] {
  return calls.map((call) => expandAnnotation(call, dirs));
}
