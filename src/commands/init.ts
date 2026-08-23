import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type InitResult = { ok: true } | { ok: false; error: string };

export const STARTER_TEMPLATE = `# This is a Cyan source file. Cyan expands @annotations inside script:
# blocks into real CI commands and writes a plain .gitlab-ci.yml file
# that GitLab CI understands natively.
#
# Run \`cyan build .gitlab-ci.cyan.yml\` to generate .gitlab-ci.yml.
# Run \`cyan expand --explain .gitlab-ci.cyan.yml\` to preview the expansion
# without writing anything.
# Run \`cyan lint .gitlab-ci.cyan.yml\` to validate annotations only.

stages:
  - build

build-image:
  stage: build
  script:
    - '@docker-build-push(dockerfile: "Dockerfile", context: ".")'
`;

const STARTER_FILENAME = ".gitlab-ci.cyan.yml";
const SNIPPETS_DIRNAME = "cyan-snippets";

type CollisionCheck =
  | { action: "write" }
  | { action: "skip" }
  | { action: "error"; error: string };

function checkStarterFileCollision(
  starterPath: string,
  force: boolean,
): CollisionCheck {
  if (!existsSync(starterPath)) {
    return { action: "write" };
  }

  if (force) {
    return { action: "write" };
  }

  return {
    action: "error",
    error: `${starterPath} already exists. Pass --force to overwrite it.`,
  };
}

function checkSnippetsDirCollision(snippetsPath: string): CollisionCheck {
  if (!existsSync(snippetsPath)) {
    return { action: "write" };
  }

  const stats = statSync(snippetsPath);

  if (!stats.isDirectory()) {
    return {
      action: "error",
      error: `${snippetsPath} already exists and is not a directory.`,
    };
  }

  const contents = readdirSync(snippetsPath);

  if (contents.length > 0) {
    return {
      action: "error",
      error: `${snippetsPath} already exists and is not empty.`,
    };
  }
  return { action: "skip" };
}

export function runInitCommand(options: {
  cwd: string;
  force: boolean;
}): InitResult {
  const starterPath = join(options.cwd, STARTER_FILENAME);
  const snippetsPath = join(options.cwd, SNIPPETS_DIRNAME);

  const starterCheck = checkStarterFileCollision(starterPath, options.force);
  if (starterCheck.action === "error") {
    return { ok: false, error: starterCheck.error };
  }

  const snippetsCheck = checkSnippetsDirCollision(snippetsPath);
  if (snippetsCheck.action === "error") {
    return { ok: false, error: snippetsCheck.error };
  }

  // starterCheck.action is "write" here (never "skip" - there's no no-op case for the starter file, only write-or-error)
  writeFileSync(starterPath, STARTER_TEMPLATE, "utf-8");

  if (snippetsCheck.action === "write") {
    mkdirSync(snippetsPath);
  }
  // if snippetsCheck.action === "skip", the dir already exists and is empty - nothing to do

  return { ok: true };
}
