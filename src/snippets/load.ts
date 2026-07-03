import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { RawSnippet } from "./types.js";

export interface LoadError {
  kind: "file-not-found" | "yaml-parse-error";
  path: string;
  message: string;
}

export type LoadResult =
  | { ok: true; value: RawSnippet }
  | { ok: false; error: LoadError };

export function loadSnippetFile(path: string): LoadResult {
  let contents: string;
  try {
    contents = readFileSync(path, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "file-not-found",
        path,
        message: `Could not read snippet file at ${path}: ${(err as Error).message}`,
      },
    };
  }

  try {
    const parsed = parse(contents);
    return { ok: true, value: parsed as RawSnippet };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "yaml-parse-error",
        path,
        message: `Invalid YAML in snippet file at ${path}: ${(err as Error).message}`,
      },
    };
  }
}
