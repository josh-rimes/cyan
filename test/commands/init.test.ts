import { describe, it, expect, vi, afterEach } from "vitest";
import { runInitCommand } from "../../src/commands/init.js";

const writeFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const existsSyncMock = vi.fn();
const statSyncMock = vi.fn();
const readdirSyncMock = vi.fn();
const readFileSyncMock = vi.fn();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      writeFileSyncMock(...args);
    },
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) => {
      mkdirSyncMock(...args);
    },
    existsSync: (...args: Parameters<typeof actual.existsSync>) => {
      return existsSyncMock(...args);
    },
    statSync: (...args: Parameters<typeof actual.statSync>) => {
      return statSyncMock(...args);
    },
    readdirSync: (...args: Parameters<typeof actual.readdirSync>) => {
      return readdirSyncMock(...args);
    },
    readFileSync: (...args: Parameters<typeof actual.readdirSync>) => {
      return readFileSyncMock(...args);
    },
  };
});

afterEach(() => {
  writeFileSyncMock.mockClear();
  mkdirSyncMock.mockClear();
  existsSyncMock.mockClear();
  statSyncMock.mockClear();
  readdirSyncMock.mockClear();
  vi.restoreAllMocks();
});

describe("runInitCommand", () => {
  it("writes starter file and creates cyan-snippets/ in a clean directory", () => {
    existsSyncMock.mockReturnValue(false);

    const result = runInitCommand({ cwd: "/fake/project", force: false });

    expect(result.ok).toBe(true);
    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [writtenPath, writtenContent] = writeFileSyncMock.mock.calls[0];
    expect(writtenPath).toContain(".gitlab-ci.cyan.yml");
    expect(writtenContent).toContain("@docker-build-push(");
    expect(writtenContent).toContain("stages:");
    expect(mkdirSyncMock).toHaveBeenCalledTimes(1);
    expect(mkdirSyncMock.mock.calls[0][0]).toContain("cyan-snippets");
  });

  it("refuses to overwrite an existing starter file without --force", () => {
    existsSyncMock.mockImplementation((path: string) =>
      path.toString().includes(".gitlab-ci.cyan.yml"),
    );

    const result = runInitCommand({ cwd: "/fake/project", force: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(".gitlab-ci.cyan.yml");
    }
    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });

  it("errors when cyan-snippets/ exists as a non-empty directory", () => {
    existsSyncMock.mockImplementation((path: string) =>
      path.toString().includes("cyan-snippets"),
    );
    statSyncMock.mockReturnValue({ isDirectory: () => true } as any);
    readdirSyncMock.mockReturnValue(["some-existing-snippet.yaml"]);

    const result = runInitCommand({ cwd: "/fake/project", force: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("cyan-snippets");
    }
    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });
});
