import { describe, it, expect } from "vitest";
import { parseAnnotation } from "../../src/annotation/parse.js";
import type { AnnotationCandidate } from "../../src/annotation/detect.js";

function candidate(raw: string): AnnotationCandidate {
  return {
    raw,
    location: { line: 1, col: 1, path: ["job", "script", 0] },
  };
}

describe("parseAnnotation", () => {
  it("parses a well-formed annotation with multiple params", () => {
    const result = parseAnnotation(
      candidate('@aws-login(region: "eu-west-1", profile: "default")'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.namespace).toBe("aws");
      expect(result.value.name).toBe("login");
      expect(result.value.params).toEqual({
        region: "eu-west-1",
        profile: "default",
      });
    }
  });

  it("parses a well-formed annotation with zero params", () => {
    const result = parseAnnotation(candidate("@docker-build-push()"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.namespace).toBe("docker");
      expect(result.value.name).toBe("build-push");
      expect(result.value.params).toEqual({});
    }
  });

  it("splits namespace/name on the first hyphen only", () => {
    const result = parseAnnotation(candidate("@kubectl-apply()"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.namespace).toBe("kubectl");
      expect(result.value.name).toBe("apply");
    }
  });

  it("produces a trailing-comma error for a trailing comma", () => {
    const result = parseAnnotation(
      candidate('@aws-login(region: "eu-west-1",)'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("trailing-comma");
    }
  });

  it("produces an unquoted-value error for an unquoted param value", () => {
    const result = parseAnnotation(candidate("@aws-login(region: eu-west-1)"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unquoted-value");
    }
  });

  it("produces an unterminated-string error for a missing closing quote", () => {
    const result = parseAnnotation(candidate('@aws-login(region: "eu-west-1)'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unterminated-string");
    }
  });

  it("produces a malformed-call-syntax error when there's no namespace separator", () => {
    const result = parseAnnotation(candidate('@login(region: "eu-west-1")'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed-call-syntax");
    }
  });

  it("produces a malformed-call-syntax error for missing parens", () => {
    const result = parseAnnotation(candidate("@aws-login"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed-call-syntax");
    }
  });

  it("preserves commas inside quoted values without splitting params incorrectly", () => {
    const result = parseAnnotation(
      candidate('@aws-login(message: "hello, world")'),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.params.message).toBe("hello, world");
    }
  });
});
