import { describe, it, expect, vi, afterEach } from "vitest";
import { join } from "node:path";
import { runBuildCommand } from "../../src/commands/build";

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

const EXPAND_FIXTURES = join(__dirname, "../fixtures/expand");
const BUILD_FIXTURES = join(__dirname, "../fixtures/build");
const LOCAL_DIR = join(EXPAND_FIXTURES, "local");
const BUNDLED_DIR = join(EXPAND_FIXTURES, "bundled-empty");

const dirs = { localDir: LOCAL_DIR, bundledDir: BUNDLED_DIR };

afterEach(() => {
  writeFileSyncMock.mockClear();
  writeFileMock.mockClear();
  vi.restoreAllMocks();
});

describe("cyan build", () => {
  it("writes the expanded file when all annotations succeed", () => {
    const path = join(BUILD_FIXTURES, "all-success.cyan.yml");
    const { text, exitCode } = runBuildCommand(path, undefined, dirs);

    expect(exitCode).toBe(0);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);

    const [outputPath, content] = writeFileSyncMock.mock.calls[0];
    expect(outputPath).toBe(join(BUILD_FIXTURES, "all-success.yml"));
    expect(content).toContain("echo before");
    expect(content).toContain("aws configure set region eu-west-1");
    expect(content).toContain("echo after");
    expect(content).toContain("# a comment that must survive");
    expect(content).not.toContain("@aws-login");
    expect(text).toContain("Build succeeded");
  });

  it("aborts with no file written when any annotation fails", () => {
    const path = join(BUILD_FIXTURES, "mixed.cyan.yml");
    const { text, exitCode } = runBuildCommand(path, undefined, dirs);

    expect(exitCode).toBe(1);
    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(text).toContain("Build aborted");
    expect(text.toLowerCase()).toContain("no snippet found");
  });

  it("treats zero annotations as a valid pass-through build", () => {
    const path = join(BUILD_FIXTURES, "zero-annotations.cyan.yml");
    const { text, exitCode } = runBuildCommand(path, undefined, dirs);

    expect(exitCode).toBe(0);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);

    const [, content] = writeFileSyncMock.mock.calls[0];
    expect(content).toContain("echo just a plain script");
    expect(content).toContain("echo another line");
    expect(text).toContain("No annotations found");
  });

  it("respects the -o flag for output path", () => {
    const path = join(BUILD_FIXTURES, "all-success.cyan.yml");
    const customOut = join(BUILD_FIXTURES, "custom-output.yml");
    runBuildCommand(path, customOut, dirs);

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [outputPath] = writeFileSyncMock.mock.calls[0];
    expect(outputPath).toBe(customOut);
  });

  it("applies default output path convention when -o is omitted", () => {
    const path = join(BUILD_FIXTURES, "zero-annotations.cyan.yml");
    runBuildCommand(path, undefined, dirs);

    const [outputPath] = writeFileSyncMock.mock.calls[0];
    expect(outputPath).toBe(join(BUILD_FIXTURES, "zero-annotations.yml"));
  });

  it("produces a clear, distinct error for a nonexistent source file, no write", () => {
    const path = join(BUILD_FIXTURES, "does-not-exist.cyan.yml");
    const { text, exitCode } = runBuildCommand(path, undefined, dirs);

    expect(text).toContain("not found");
    expect(exitCode).toBe(1);
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });

  it("produces a clear, distinct error for invalid YAML, no write", () => {
    const path = join(BUILD_FIXTURES, "invalid.cyan.yml");
    const { text, exitCode } = runBuildCommand(path, undefined, dirs);

    expect(text.toLowerCase()).toContain("invalid yaml");
    expect(exitCode).toBe(1);
    expect(writeFileSyncMock).not.toHaveBeenCalled();
  });
});
