import {
  loadSourceAnnotations,
  type SourceReadError,
  type SourceParseError,
} from "./shared/load-source.js";
import {
  expandAnnotations,
  type ExpandResult,
  type ExpansionFailure,
} from "../expand/expand.js";
import type { ResolveDirs } from "../expand/resolve.js";
import type {
  AnnotationParseError,
  AnnotationLocation,
} from "../annotation/types.js";
import {
  formatCallParseError,
  formatExpandError,
  formatLocation,
} from "./expand.js";

export type LintItem =
  | { kind: "call-parse-error"; error: AnnotationParseError }
  | { kind: "expand-result"; result: ExpandResult };

export interface LintOutput {
  text: string;
  exitCode: 0 | 1;
}

function formatLintFailure(failure: ExpansionFailure): string {
  const header = formatLocation(failure.location);
  const identity = `FAILED: ${failure.namespace}/${failure.name}`;
  const errorLines = failure.error
    .map((e) => `  * ${formatExpandError(e)}`)
    .join("\n");

  return [header, identity, errorLines].join("\n");
}

function formatLintPass(
  location: AnnotationLocation,
  namespace: string,
  name: string,
): string {
  return `${formatLocation(location)}\n OK: ${namespace}/${name}`;
}

export function runLintCheck(
  path: string,
  dirs: ResolveDirs,
):
  | { ok: true; items: LintItem[] }
  | { ok: false; error: SourceReadError | SourceParseError } {
  const loaded = loadSourceAnnotations(path);

  if (!loaded.ok) {
    return loaded;
  }

  const expandResults = expandAnnotations(loaded.calls, dirs);

  const items: LintItem[] = [
    ...loaded.candidateErrors.map(
      (error): LintItem => ({ kind: "call-parse-error", error }),
    ),
    ...expandResults.map(
      (result): LintItem => ({ kind: "expand-result", result }),
    ),
  ];

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

export function renderLintOutput(items: LintItem[]): LintOutput {
  if (items.length === 0) {
    return {
      text: "No annotations found. Nothing to lint.",
      exitCode: 0,
    };
  }

  const failedCount = items.filter(
    (item) => item.kind === "call-parse-error" || !item.result.ok,
  ).length;

  const anyFailure = failedCount > 0;

  if (!anyFailure) {
    return {
      text: `${items.length} annotation(s) checked, all valid.`,
      exitCode: 0,
    };
  }

  const blocks = items.map((item) => {
    if (item.kind === "call-parse-error") {
      return formatCallParseError(item.error);
    }
    if (item.result.ok) {
      return formatLintPass(
        item.result.location,
        item.result.namespace,
        item.result.name,
      );
    }
    return formatLintFailure(item.result);
  });

  const summary = `\n${items.length} annotation(s) checked, ${failedCount} failed.`;

  return {
    text: blocks.join("\n\n") + "\n" + summary,
    exitCode: 1,
  };
}

export function runLintCommand(path: string, dirs: ResolveDirs): LintOutput {
  const loaded = runLintCheck(path, dirs);

  if (!loaded.ok) {
    return { text: loaded.error.message, exitCode: 1 };
  }

  return renderLintOutput(loaded.items);
}
