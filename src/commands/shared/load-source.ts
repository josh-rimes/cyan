import { readFileSync } from "node:fs";
import { parseYamlSource, detectAnnotations } from "../../annotation/detect.js";
import { parseAnnotation } from "../../annotation/parse.js";
import {
  AnnotationCall,
  AnnotationParseError,
} from "../../annotation/types.js";

export interface SourceReadError {
  kind: "source-not-found";
  path: string;
  message: string;
}

export interface SourceParseError {
  kind: "invalid-yaml";
  path: string;
  message: string;
}

export type SourceLoadResult =
  | {
      ok: true;
      calls: AnnotationCall[];
      candidateErrors: AnnotationParseError[];
    }
  | { ok: false; error: SourceReadError | SourceParseError };

export function loadSourceAnnotations(path: string): SourceLoadResult {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return {
      ok: false,
      error: {
        kind: "source-not-found",
        path,
        message: `Source file was not found: ${path}`,
      },
    };
  }

  const { doc, lineCounter } = parseYamlSource(text);

  if (doc.errors.length > 0) {
    return {
      ok: false,
      error: {
        kind: "invalid-yaml",
        path,
        message: `Invalid YAML in ${path}: ${doc.errors.map((e) => e.message).join("; ")}`,
      },
    };
  }

  const candidates = detectAnnotations(doc, lineCounter);

  const calls: AnnotationCall[] = [];
  const candidateErrors: AnnotationParseError[] = [];

  for (const candidate of candidates) {
    const result = parseAnnotation(candidate);
    if (result.ok) {
      calls.push(result.value);
    } else {
      candidateErrors.push(result.error);
    }
  }

  return { ok: true, calls, candidateErrors };
}
