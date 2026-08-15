import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { loadSnippetFile } from "../../src/snippets/load";
import { validateSnippet } from "../../src/snippets/validate";

const BUNDLED_DIR = "src/snippets/bundled";

function loadValidated(namespace: string, name: string) {
  const path = join(BUNDLED_DIR, namespace, `${name}.yaml`);
  const loaded = loadSnippetFile(path);

  if (!loaded.ok)
    throw new Error(`Bundled snippet failed to load: ${loaded.error.message}`);

  return validateSnippet(loaded.value);
}

describe("bundled snippets", () => {
  it("aws-login loads and validates", () => {
    const result = loadValidated("aws", "login");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.namespace).toBe("aws");
    expect(result.value.name).toBe("login");
  });

  it("azure-login loads and validates", () => {
    const result = loadValidated("azure", "login");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.namespace).toBe("azure");
    expect(result.value.name).toBe("login");
  });

  it("docker-build-push loads and validates", () => {
    const result = loadValidated("docker", "build-push");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.namespace).toBe("docker");
    expect(result.value.name).toBe("build-push");
  });

  it("kubectl loads and validates", () => {
    const result = loadValidated("kubectl", "apply");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.namespace).toBe("kubectl");
    expect(result.value.name).toBe("apply");
  });
});
