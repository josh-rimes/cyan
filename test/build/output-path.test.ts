import { describe, it, expect } from "vitest";
import { sep } from "node:path";
import { resolveOutputPath } from "../../src/build/output-path";

describe("resolveOutputPath", () => {
  it("uses the -o flag verbatim when provided", () => {
    expect(resolveOutputPath("pipeline.cyan.yml", "custom-output.yml")).toBe(
      "custom-output.yml",
    );
  });

  it("strips .cyan.yml to .yml in the same directory, no -o given", () => {
    expect(resolveOutputPath("pipeline.cyan.yml")).toBe("pipeline.yml");
  });

  it("preserves a subdirectory when stripping .cyan.yml", () => {
    expect(resolveOutputPath("ci/pipeline.cyan.yml")).toBe(
      ["ci", "pipeline.yml"].join(sep),
    );
  });

  it("falls back gracefully for a source not ending in .cyan.yml", () => {
    expect(resolveOutputPath("weird.yaml")).toBe("weird.yml");
  });

  it("falls back gracefully for a source with no extension at all", () => {
    expect(resolveOutputPath("noext")).toBe("noext.yml");
  });

  it("-o flag takes priority even for a non-.cyan.yml source", () => {
    expect(resolveOutputPath("weird.yaml", "out.yml")).toBe("out.yml");
  });
});
