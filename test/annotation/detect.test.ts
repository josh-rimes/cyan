import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseYamlSource,
  detectAnnotations,
  looksLikeAnnotationCandidate,
} from "../../src/annotation/detect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "../fixtures/annotation/mixed.cyan.yml");

describe("looksLikeAnnotationCandidate", () => {
  it("matches a well-formed annotation shape", () => {
    expect(looksLikeAnnotationCandidate('@aws-login(region: "x")')).toBe(true);
  });

  it("matches even a malformed-but-attempted annotation", () => {
    expect(looksLikeAnnotationCandidate("@aws-login(region: x)")).toBe(true);
  });

  it("does not match a plain script line", () => {
    expect(looksLikeAnnotationCandidate("npm run build")).toBe(false);
  });

  it("does not match annotation-like text embedded mid-string", () => {
    expect(
      looksLikeAnnotationCandidate('echo "see @aws-login() for details"'),
    ).toBe(false);
  });
});

describe("detectAnnotations", () => {
  it("finds all candidates across multiple script: blocks and ignores non-script sequences", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const { doc, lineCounter } = parseYamlSource(source);
    const candidates = detectAnnotations(doc, lineCounter);

    // Expect exactly the 5 candidate lines from the fixture:
    // aws-login (valid), docker-build-push (valid),
    // kubectl-apply (valid), aws-login (trailing comma),
    // aws-login (unquoted value).
    expect(candidates).toHaveLength(5);

    const rawTexts = candidates.map((c) => c.raw);
    expect(rawTexts).toContain(
      '@aws-login(region: "eu-west-1", profile: "default")',
    );
    expect(rawTexts).toContain("@docker-build-push()");
    expect(rawTexts).toContain(
      '@kubectl-apply(cluster: "prod", namespace: "default")',
    );
    expect(rawTexts).toContain('@aws-login(region: "eu-west-1",)');
    expect(rawTexts).toContain("@aws-login(region: eu-west-1)");
  });

  it("does not detect a mid-string mention as an annotation", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const { doc, lineCounter } = parseYamlSource(source);
    const candidates = detectAnnotations(doc, lineCounter);
    const rawTexts = candidates.map((c) => c.raw);

    expect(
      rawTexts.some((r) => r.includes("mid-string should NOT be detected")),
    ).toBe(false);
  });

  it("does not detect annotations inside a non-script sequence", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const { doc, lineCounter } = parseYamlSource(source);
    const candidates = detectAnnotations(doc, lineCounter);
    const rawTexts = candidates.map((c) => c.raw);

    expect(rawTexts.some((r) => r.includes("should-be-ignored"))).toBe(false);
  });

  it("attaches correct path including the parent job key", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const { doc, lineCounter } = parseYamlSource(source);
    const candidates = detectAnnotations(doc, lineCounter);

    const dockerCandidate = candidates.find((c) =>
      c.raw.startsWith("@docker-build-push"),
    );
    expect(dockerCandidate?.location.path).toEqual(["build-job", "script", 3]);
  });
});
