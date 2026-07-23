import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { expandAnnotation, expandAnnotations } from "../../src/expand/expand";
import type {
  AnnotationCall,
  AnnotationLocation,
} from "../../src/annotation/types";
import type { ResolveDirs } from "../../src/expand/resolve";

const FIXTURE_DIRS: ResolveDirs = {
  localDir: join(__dirname, "../fixtures/expand/local"),
  bundledDir: join(__dirname, "../fixtures/expand/bundled"),
};

function loc(overrides: Partial<AnnotationLocation> = {}): AnnotationLocation {
  return { line: 1, col: 1, path: ["build", "script", 0], ...overrides };
}

function call(overrides: Partial<AnnotationCall> = {}): AnnotationCall {
  return {
    namespace: "aws",
    name: "login",
    params: {},
    location: loc(),
    ...overrides,
  };
}

describe("expandAnnotation", () => {
  it("resolves a valid annotation against a bundled-only snippet and interpolates correctly", () => {
    const result = expandAnnotation(
      call({
        namespace: "docker",
        name: "build-push",
        params: { image: "registry.example.com/app:latest" },
      }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("bundled");
    expect(result.version).toBe("1.0.0");
    expect(result.resolvedLines).toEqual([
      "docker build -t registry.example.com/app:latest .",
      "docker push registry.example.com/app:latest",
    ]);
  });

  it("uses a local override instead of the bundled snippet of the same namespace/name", () => {
    const result = expandAnnotation(
      call({ params: { region: "eu-west-1" } }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("local");
    expect(result.version).toBe("2.0.0-local");
    expect(result.resolvedLines[0]).toContain("local override");
  });

  it("produces an unknown-snippet error for an unrecognised namespace/name", () => {
    const result = expandAnnotation(
      call({ namespace: "azure", name: "login", params: {} }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toHaveLength(1);
    expect(result.error[0].kind).toBe("unknown-snippet");
  });

  it("produces a missing-required-param error when a required param has no default and isn't supplied", () => {
    const result = expandAnnotation(
      call({ namespace: "docker", name: "build-push", params: {} }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toHaveLength(1);
    expect(result.error[0]).toMatchObject({
      kind: "missing-required-param",
      parameter: "image",
    });
  });

  it("uses a param's default when not supplied in the call", () => {
    const result = expandAnnotation(
      call({ params: { region: "us-east-1" } }), // profile omitted, has default
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedLines[1]).toContain("--profile default");
  });

  it("leaves $CI_COMMIT_SHA-style variables untouched while substituting {{param}}", () => {
    const result = expandAnnotation(
      call({
        namespace: "test",
        name: "vars",
        params: { message: "deploying" },
      }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resolvedLines).toEqual([
      "echo deploying at commit $CI_COMMIT_SHA",
    ]);
  });

  it("flags an unknown param supplied in the call that isn't in the snippet's schema", () => {
    const result = expandAnnotation(
      call({
        namespace: "docker",
        name: "build-push",
        params: { image: "app", typo_param: "x" },
      }),
      FIXTURE_DIRS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.some((e) => e.kind === "unknown-param")).toBe(true);
  });
});

describe("expandAnnotations", () => {
  it("resolves multiple annotations independently, mixing success and failure", () => {
    const calls: AnnotationCall[] = [
      call({
        params: { region: "us-east-1" },
        location: loc({ line: 3, path: ["build", "script", 0] }),
      }),
      call({
        namespace: "azure",
        name: "login",
        params: {},
        location: loc({ line: 4, path: ["build", "script", 1] }),
      }),
      call({
        namespace: "docker",
        name: "build-push",
        params: { image: "app" },
        location: loc({ line: 5, path: ["build", "script", 2] }),
      }),
    ];

    const results = expandAnnotations(calls, FIXTURE_DIRS);

    expect(results).toHaveLength(3);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
  });
});
