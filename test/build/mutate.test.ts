import { describe, it, expect } from "vitest";
import { parseYamlSource } from "../../src/annotation/detect";
import { applyExpansions } from "../../src/build/mutate";
import type { ExpansionSuccess } from "../../src/expand/expand";

function makeSuccess(
  path: (string | number)[],
  resolvedLines: string[],
): ExpansionSuccess {
  return {
    ok: true,
    location: { line: 1, col: 1, path },
    namespace: "test",
    name: "snippet",
    version: "1.0.0",
    source: "bundled",
    resolvedLines,
  };
}

describe("applyExpansions", () => {
  it("replaces a single annotation item with N expanded lines", () => {
    const source = [
      "build:",
      "  script:",
      "     - echo start",
      "     - '@aws-login(region: \"eu-west-1\")'",
      "     - echo end",
    ].join("\n");

    const { doc } = parseYamlSource(source);

    applyExpansions(doc, [
      makeSuccess(
        ["build", "script", 1],
        ["aws configure line 1", "aws configure line 2"],
      ),
    ]);

    const output = doc.toString();

    expect(output).toContain("echo start");
    expect(output).toContain("aws configure line 1");
    expect(output).toContain("aws configure line 2");
    expect(output).toContain("echo end");
    expect(output).not.toContain("@aws-login");
  });

  it("handles multiple annotations in the same script array without index corruption", () => {
    const source = [
      "build:",
      "  script:",
      "    - '@aws-login(region: \"eu-west-1\")'",
      "    - echo middle",
      "    - '@docker-build-push(dockerfile: \"Dockerfile\")'",
      "    - echo end",
    ].join("\n");

    const { doc } = parseYamlSource(source);

    // Deliberately passed in ascending order to prove applyExpansions
    // does its own descending-order handling internally.
    applyExpansions(doc, [
      makeSuccess(
        ["build", "script", 0],
        ["aws line 1", "aws line 2", "aws line 3"],
      ),
      makeSuccess(["build", "script", 2], ["docker line 1"]),
    ]);

    const output = doc.toString();
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Expect the reading-order sequence to be intact and uncorrupted.
    expect(lines).toEqual([
      "build:",
      "script:",
      "- aws line 1",
      "- aws line 2",
      "- aws line 3",
      "- echo middle",
      "- docker line 1",
      "- echo end",
    ]);
  });

  it("handles annotations in different script arrays (different jobs)", () => {
    const source = [
      "build:",
      "  script:",
      "    - '@aws-login(region: \"eu-west-1\")'",
      "deploy:",
      "  script:",
      '    - \'@kubectl-apply(context: "prod", manifest: "deploy.yaml")\'',
    ].join("\n");

    const { doc } = parseYamlSource(source);

    applyExpansions(doc, [
      makeSuccess(["build", "script", 0], ["aws line"]),
      makeSuccess(["deploy", "script", 0], ["kubectl line"]),
    ]);

    const output = doc.toString();

    expect(output).toContain("aws line");
    expect(output).toContain("kubectl line");
    expect(output).not.toContain("@aws-login");
    expect(output).not.toContain("@kubectl-apply");
  });

  it("preserves formatting and comments outside the mutated items", () => {
    const source = [
      "# top-level comment",
      "build:",
      "  script:",
      "    - echo start # inline comment",
      "    - '@aws-login(region: \"eu-west-1\")'",
      "",
      "# trailing comment",
    ].join("\n");

    const { doc } = parseYamlSource(source);

    applyExpansions(doc, [
      makeSuccess(["build", "script", 1], ["expanded line"]),
    ]);

    const output = doc.toString();

    expect(output).toContain("# top-level comment");
    expect(output).toContain("echo start # inline comment");
    expect(output).toContain("# trailing comment");
    expect(output).toContain("expanded line");
  });

  it("throws if the resolved path does not point to a sequence (invariant violation)", () => {
    const source = ["build:", "  script:", "    - echo only"].join("\n");

    const { doc } = parseYamlSource(source);

    // "build.script" itself is a seq, but "build" alone is a map - passing a path that resolves to a non-seq should throw, since this represents a bug in location tracking, not a user error.
    expect(() =>
      applyExpansions(doc, [makeSuccess(["build"], ["oops"])]),
    ).toThrow(/expected a YAML sequence/);
  });
});
