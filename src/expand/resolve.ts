import { join } from "node:path";
import { loadSnippetFile } from "../snippets/load.js";
import { validateSnippet } from "../snippets/validate.js";
import type { Snippet } from "../snippets/types.js";
import type { LoadError } from "../snippets/load.js";
import type { ValidationError } from "../snippets/validate.js";
import type { AnnotationLocation } from "../annotation/types.js";

export type SnippetSource = "local" | "bundled";

export interface ResolvedSnippet {
  snippet: Snippet;
  source: SnippetSource;
  path: string;
}

export interface UnknownSnippetError {
  kind: "unknown-snippet";
  namespace: string;
  name: string;
  location: AnnotationLocation;
  message: string;
}

export interface SnippetLoadFailure {
  kind: "snippet-load-error";
  namespace: string;
  name: string;
  source: SnippetSource;
  path: string;
  location: AnnotationLocation;
  loadError: LoadError;
  message: string;
}

export interface SnippetValidationFailure {
  kind: "snippet-validation-error";
  namespace: string;
  name: string;
  source: SnippetSource;
  path: string;
  location: AnnotationLocation;
  errors: ValidationError[];
  message: string;
}

export type ResolveError =
  | UnknownSnippetError
  | SnippetLoadFailure
  | SnippetValidationFailure;

export type ResolveResult =
  | { ok: true; value: ResolvedSnippet }
  | { ok: false; error: ResolveError };

export interface ResolveDirs {
  localDir: string;
  bundledDir: string;
}

/**
 * Attempts to load+validate a snippet at a specific path.
 * Returns:
 * - { found: false } if the file simply doesn't exist at this path
 *   (caller should try the next location)
 * - { found: true, result } if the file exists but either failed to load/parse or failed validation, or succeeded
 */
function tryLoadAt(
  path: string,
  namespace: string,
  name: string,
  source: SnippetSource,
  location: AnnotationLocation,
): { found: false } | { found: true; result: ResolveResult } {
  const loaded = loadSnippetFile(path);

  if (!loaded.ok) {
    if (loaded.error.kind === "file-not-found") {
      return { found: false };
    }

    return {
      found: true,
      result: {
        ok: false,
        error: {
          kind: "snippet-load-error",
          namespace,
          name,
          source,
          path,
          location,
          loadError: loaded.error,
          message: `Failed to load ${source} snippet "${namespace}-${name}" at ${path}: ${loaded.error.message}`,
        },
      },
    };
  }

  const validated = validateSnippet(loaded.value);

  if (!validated.ok) {
    return {
      found: true,
      result: {
        ok: false,
        error: {
          kind: "snippet-validation-error",
          namespace,
          name,
          source,
          path,
          location,
          errors: validated.errors,
          message: `Snippet "${namespace}-${name}" at ${path} failed validation`,
        },
      },
    };
  }

  return {
    found: true,
    result: {
      ok: true,
      value: { snippet: validated.value, source, path },
    },
  };
}

export function resolveSnippet(
  namespace: string,
  name: string,
  location: AnnotationLocation,
  dirs: ResolveDirs,
): ResolveResult {
  const localPath = join(dirs.localDir, namespace, `${name}.yaml`);
  const local = tryLoadAt(localPath, namespace, name, "local", location);

  if (local.found) {
    return local.result;
  }

  const bundledPath = join(dirs.bundledDir, namespace, `${name}.yaml`);
  const bundled = tryLoadAt(bundledPath, namespace, name, "bundled", location);

  if (bundled.found) {
    return bundled.result;
  }

  return {
    ok: false,
    error: {
      kind: "unknown-snippet",
      namespace,
      name,
      location,
      message: `No snippet found for "${namespace}-${name}" (checked ${localPath} and ${bundledPath})`,
    },
  };
}
