import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { runLintCommand } from "../../src/commands/lint";
import { STARTER_TEMPLATE } from "../../src/commands/init";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledDir = join(__dirname, "../../src/snippets/bundled");

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("starter template drift check", () => {
  it("the starter template's annotation resolves cleanly against the real bundled snippet", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "cyan-init-drift-"));
    const starterPath = join(tmpDir, ".gitlab-ci.cyan.yml");
    writeFileSync(starterPath, STARTER_TEMPLATE, "utf-8");

    const { text, exitCode } = runLintCommand(starterPath, {
      localDir: join(tmpDir, "nonexistent-local-dir"),
      bundledDir,
    });

    expect(exitCode).toBe(0);
    expect(text).toMatch(/^\d+ annotation\(s\) checked, all valid\.$/);
  });
});
