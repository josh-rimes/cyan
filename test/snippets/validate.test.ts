import { describe, it, expect } from "vitest";
import { loadSnippetFile } from "../../src/snippets/load";
import { validateSnippet } from "../../src/snippets/validate";

const FIXTURE_PATH = "test/fixtures/snippets/aws-login.yaml";

function loadRaw(path: string) {
  const result = loadSnippetFile(path);

  if (!result.ok)
    throw new Error(`Fixture failed to load: ${result.error.message}`);

  return result.value;
}

describe("validateSnippet", () => {
  it("accepts a valid snippet file", () => {
    const raw = loadRaw(FIXTURE_PATH);
    const result = validateSnippet(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("login");
    expect(result.value.namespace).toBe("aws");
    expect(result.value.script).toHaveLength(4);
    expect(result.value.parameters.region.default).toBe("us-east-1");
  });

  it("rejects a snippet missing required top-level fields", () => {
    const result = validateSnippet({
      // name missing
      namespace: "aws",
      version: "1.0.0",
      description: "desc",
      script: ["echo hi"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it('rejects a parameter missing "type"', () => {
    const result = validateSnippet({
      name: "x",
      namespace: "aws",
      version: "1.0.0",
      description: "d",
      parameters: { foo: { required: true } },
      script: ["echo hi"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "parameters.foo.type")).toBe(
      true,
    );
  });

  it('rejects a parameter missing "required"', () => {
    const result = validateSnippet({
      name: "x",
      namespace: "aws",
      version: "1.0.0",
      description: "d",
      parameters: { foo: { type: "string" } },
      script: ["echo hi"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.errors.some((e) => e.field === "parameters.foo.required"),
    ).toBe(true);
  });

  it("rejects a script that is not a flat list of strings", () => {
    const result = validateSnippet({
      name: "x",
      namespace: "aws",
      version: "1.0.0",
      description: "d",
      script: ["echo hi", 42, ["nested"]],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "script")).toBe(true);
  });

  it('treats a missing "parameters" key as zero parameters', () => {
    const result = validateSnippet({
      name: "x",
      namespace: "aws",
      version: "1.0.0",
      description: "d",
      script: ["echo hi"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parameters).toEqual({});
  });

  it("rejects an empty script list", () => {
    const result = validateSnippet({
      name: "x",
      namespace: "aws",
      version: "1.0.0",
      description: "d",
      script: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "script")).toBe(true);
  });
});
