import { describe, it, expect, vi, afterEach } from "vitest";
import { join } from "node:path";
import { runLintCommand } from "../../src/commands/lint";
import { writeFileSync } from "node:fs";

const writeFileSyncMock = vi.fn();
const writeFileMock = vi.fn();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      writeFileSyncMock(...args);
    },
    promises: {
      ...actual.promises,
      writeFile: (...args: Parameters<typeof actual.promises.writeFile>) => {
        writeFileMock(...args);
        return Promise.resolve();
      },
    },
  };
});

const FIXTURES = join(__dirname, "../fixtures/expand");
const LOCAL_DIR = join(FIXTURES, "local");
const BUNDLED_DIR = join(FIXTURES, "bundled-empty");

const dirs = { localDir: LOCAL_DIR, bundledDir: BUNDLED_DIR };

afterEach(() => {
  writeFileSyncMock.mockClear();
  writeFileMock.mockClear();
  vi.restoreAllMocks();
});

describe("cyan lint", () => {
  it("fails with a per-item breakdown for a mix of valid and invalid annotations", () => {
    const path = join(FIXTURES, "mixed.cyan.yml");
    const { text, exitCode } = runLintCommand(path, dirs);

    expect(text).toContain("OK: aws/login");

    expect(text).toContain("unquoted-value");

    expect(text).toContain("FAILED: docker/build-push");
    expect(text.toLowerCase()).toContain("no snippet found");

    expect(text).toContain('Unknown parameter "extra"');

    expect(text).not.toContain("v2.0.0-local");
    expect(text).not.toContain("expands to:");

    expect(text).toMatch(/\d+ annotation\(s\) checked, \d+ failed\./);
    expect(exitCode).toBe(1);
  });

  it("gives a single-line summary with no per-item detail when everything passes", () => {
    const path = join(FIXTURES, "all-success.cyan.yml");
    const { text, exitCode } = runLintCommand(path, dirs);

    expect(text).toMatch(/^\d+ annotation\(s\) checked, all valid\.$/);
    expect(text).not.toContain("OK:");
    expect(exitCode).toBe(0);
  });

  it("produces sensible non-error output for a file with zero annotations", () => {
    const path = join(FIXTURES, "zero-annotations.cyan.yml");
    const { text, exitCode } = runLintCommand(path, dirs);

    expect(text).toContain("No annotations found");
    expect(exitCode).toBe(0);
  });

  it("produces a clear, distinct error for a nonexistent source file", () => {
    const path = join(FIXTURES, "does-not-exist.cyan.yml");
    const { text, exitCode } = runLintCommand(path, dirs);

    expect(text).toContain("not found");
    expect(text).toContain(path);
    expect(exitCode).toBe(1);
  });

  it("produces a clear, distinct error for invalid YAML", () => {
    const path = join(FIXTURES, "invalid.cyan.yml");
    const { text, exitCode } = runLintCommand(path, dirs);

    expect(text.toLowerCase()).toContain("invalid yaml");
    expect(exitCode).toBe(1);
  });

  it("never writes any file as a side effect", () => {
    const path = join(FIXTURES, "mixed.cyan.yml");
    runLintCommand(path, dirs);

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
