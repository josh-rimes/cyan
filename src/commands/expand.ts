import {
  loadSourceAnnotations,
  type SourceReadError,
  type SourceParseError,
} from "./shared/load-source.js";
import {
  AnnotationParseError,
  AnnotationLocation,
} from "../annotation/types.js";
import {
  expandAnnotations,
  type ExpandResult,
  type ExpansionSuccess,
  type ExpansionFailure,
  type ExpandError,
} from "../expand/expand.js";
import { ResolveDirs } from "../expand/resolve.js";

export interface ExplainOutput {
  text: string;
  exitCode: 0 | 1;
}

export type ExplainItem =
  | { kind: "call-parse-error"; error: AnnotationParseError }
  | { kind: "expand-result"; result: ExpandResult };

export function runExpandExplain(
  path: string,
  dirs: ResolveDirs,
):
  | { ok: true; items: ExplainItem[] }
  | { ok: false; error: SourceReadError | SourceParseError } {
  const loaded = loadSourceAnnotations(path);

  if (!loaded.ok) {
    return loaded;
  }

  const expandResults = expandAnnotations(loaded.calls, dirs);

  // Merge both failure populations into one reading-order-friendly list.
  const items: ExplainItem[] = [
    ...loaded.candidateErrors.map(
      (error): ExplainItem => ({ kind: "call-parse-error", error }),
    ),
    ...expandResults.map(
      (result): ExplainItem => ({ kind: "expand-result", result }),
    ),
  ];

  // Sort by location.line so output reads top-to-bottom regardless of
  // which population an item came from.
  items.sort((a, b) => {
    const lineA =
      a.kind === "call-parse-error"
        ? a.error.location.line
        : a.result.location.line;
    const lineB =
      b.kind === "call-parse-error"
        ? b.error.location.line
        : b.result.location.line;

    return lineA - lineB;
  });

  return { ok: true, items };
}

export function formatLocation(location: AnnotationLocation): string {
  const pathStr = location.path
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : seg))
    .join(".")
    .replace(/\.\[/g, "["); // "script.[2]" -> "script[2]"

  return `Line ${location.line}, col ${location.col} - ${pathStr}`;
}

export function formatSuccess(result: ExpansionSuccess): string {
  const header = formatLocation(result.location);
  const identity = `  resolved: ${result.namespace}/${result.name} (v${result.version}, ${result.source})`;
  const linesHeader = ` expands to:`;
  const lines = result.resolvedLines.map((line) => `    ${line}`).join("\n");

  return [header, identity, linesHeader, lines].join("\n");
}

export function formatExpandError(error: ExpandError): string {
  if (error.kind === "snippet-validation-error") {
    const fieldErrors = error.errors
      .map((ve) => `filed "${ve.field}": ${ve.message}`)
      .join("; ");
    return `${error.message} - ${fieldErrors}`;
  }

  return error.message;
}

export function formatFailure(failure: ExpansionFailure): string {
  const header = formatLocation(failure.location);
  const identity = `  failed: ${failure.namespace}/${failure.name}`;
  const errorLines = failure.error
    .map((e) => `   - ${formatExpandError(e)}`)
    .join("\n");

  return [header, identity, errorLines].join("\n");
}

export function formatCallParseError(error: AnnotationParseError): string {
  const header = formatLocation(error.location);
  const indentity = `FAIL: failed to parse annotation call (${error.kind})`;
  const detail = `    - ${error.message}`;
  const rawLine = `   raw: ${error.raw}`;

  return [header, indentity, detail, rawLine].join("\n");
}

export function renderExplainOutput(items: ExplainItem[]): ExplainOutput {
  if (items.length === 0) {
    return {
      text: "No annotations found. Nothing to explain.",
      exitCode: 0,
    };
  }

  const blocks = items.map((item) => {
    if (item.kind === "call-parse-error") {
      return formatCallParseError(item.error);
    }
    if (item.result.ok) {
      return formatSuccess(item.result);
    }
    return formatFailure(item.result);
  });

  const anyFailure = items.some(
    (item) => item.kind === "call-parse-error" || !item.result.ok,
  );

  const failedCount = items.filter(
    (item) => item.kind === "call-parse-error" || !item.result.ok,
  ).length;

  const summary = anyFailure
    ? `\n${items.length} annotation(s) checked, ${failedCount} failed.`
    : `\n${items.length} annotation(s) checked, all resolved.`;

  return {
    text: blocks.join("\n\n") + "\n" + summary,
    exitCode: anyFailure ? 1 : 0,
  };
}

export function runExplainCommand(
  path: string,
  dirs: ResolveDirs,
): { text: string; exitCode: 0 | 1 } {
  const loaded = runExpandExplain(path, dirs);

  if (!loaded.ok) {
    return { text: loaded.error.message, exitCode: 1 };
  }

  return renderExplainOutput(loaded.items);
}
