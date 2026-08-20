import { writeFileSync } from "node:fs";
import { loadSourceAnnotations } from "./shared/load-source.js";
import { expandAnnotations, type ExpansionSuccess } from "../expand/expand.js";
import type { ResolveDirs } from "../expand/resolve.js";
import { applyExpansions } from "../build/mutate.js";
import { resolveOutputPath } from "../build/output-path.js";
import { formatCallParseError, formatFailure } from "./expand.js";

export interface BuildOutput {
  text: string;
  exitCode: 0 | 1;
}

export function runBuildCommand(
  sourcePath: string,
  outputFlag: string | undefined,
  dirs: ResolveDirs,
): BuildOutput {
  const loaded = loadSourceAnnotations(sourcePath);

  if (!loaded.ok) {
    return { text: loaded.error.message, exitCode: 1 };
  }

  const expandResults = expandAnnotations(loaded.calls, dirs);

  const failures = expandResults.filter((r) => !r.ok);
  const anyFailure = loaded.candidateErrors.length > 0 || failures.length > 0;

  if (anyFailure) {
    const blocks = [
      ...loaded.candidateErrors.map(formatCallParseError),
      ...failures.map((f) =>
        formatFailure(f as Exclude<typeof f, { ok: true }>),
      ),
    ];
    const summary = `\nBuild aborted: ${blocks.length} annotation(s) failed. No file written.`;
    return { text: blocks.join("\n\n") + "\n" + summary, exitCode: 1 };
  }

  // All succeeded (or there were zero annotations) - safe to mutate + write.
  const successes = expandResults as ExpansionSuccess[];

  applyExpansions(loaded.doc, successes);

  const outputPath = resolveOutputPath(sourcePath, outputFlag);
  writeFileSync(outputPath, loaded.doc.toString(), "utf-8");

  const count = successes.length;
  const outputText =
    count === 0
      ? `No annotations found. Wrote ${outputPath} unchanged.`
      : `Build succeeded: ${count} annotation(s) expanded. Wrote ${outputPath}.`;

  return { text: outputText, exitCode: 0 };
}
