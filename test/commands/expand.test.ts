import { describe, it, expect, vi, afterEach } from "vitest";
import { join } from "node:path";
import { runExplainCommand } from "../../src/commands/expand";

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
const BUNDLED_DIR = join(FIXTURES, "bundled-empty"); // intentionally empty

const dirs = { localDir: LOCAL_DIR, bundledDir: BUNDLED_DIR };

afterEach(() => {
  writeFileSyncMock.mockClear();
  writeFileMock.mockClear();
  vi.restoreAllMocks();
});

describe("cyan expand --explain", () => {
  it("produces correct output for a mix of successful and failing annotations", () => {
    const path = join(FIXTURES, "mixed.cyan.yml");
    const { text, exitCode } = runExplainCommand(path, dirs);

    // success case
    expect(text).toContain("aws/login");
    expect(text).toContain("v2.0.0-local");
    expect(text).toContain("local");
    expect(text).toContain("aws configure set region eu-west-1");
    expect(text).toContain("aws sts get-caller-identity --profile default");

    // parse failure (unquoted value)
    expect(text).toContain("unquoted-value");
    expect(text).toContain("region: eu-west-1");

    // unknown-snippet
    expect(text).toContain("docker/build-push");
    expect(text.toLowerCase()).toContain("no snippet found");

    // unknown-param validation failure
    expect(text).toContain('Unknown parameter "extra"');

    expect(exitCode).toBe(1);
  });

  it("produces sensible non-error output for a file with zero annotations", () => {
    const path = join(FIXTURES, "zero-annotations.cyan.yml");
    const { text, exitCode } = runExplainCommand(path, dirs);

    expect(text).toContain("No annotations found");
    expect(exitCode).toBe(0);
  });

  it("produces a clear, distinct error for a nonexistent source file", () => {
    const path = join(FIXTURES, "does-not-exist.cyan.yml");
    const { text, exitCode } = runExplainCommand(path, dirs);

    expect(text).toContain("not found");
    expect(text).toContain(path);
    expect(exitCode).toBe(1);
  });

  it("produces a clear, distinct error for invalid YAML", () => {
    const path = join(FIXTURES, "invalid.cyan.yml");
    const { text, exitCode } = runExplainCommand(path, dirs);

    expect(text.toLowerCase()).toContain("invalid yaml");
    expect(exitCode).toBe(1);
  });

  it("exits 0 when every annotation resolves successfully", () => {
    const path = join(FIXTURES, "all-success.cyan.yml");
    const { exitCode } = runExplainCommand(path, dirs);

    expect(exitCode).toBe(0);
  });

  it("never writes any file as a side effect", () => {
    const path = join(FIXTURES, "mixed.cyan.yml");
    runExplainCommand(path, dirs);

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
