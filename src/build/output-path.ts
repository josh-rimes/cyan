import { join, dirname, basename } from "node:path";

export function resolveOutputPath(
  sourcePath: string,
  outputFlag?: string,
): string {
  if (outputFlag) {
    return outputFlag;
  }

  const dir = dirname(sourcePath);
  const base = basename(sourcePath);

  if (base.endsWith(".cyan.yml")) {
    const stripped = base.slice(0, -".cyan.yml".length);
    return join(dir, `${stripped}.yml`);
  }

  // Graceful fallback: source doesn't follow the .cyan.yml convention. Strip whatever extension is present (if any) and append .yml.
  const dotIndex = base.lastIndexOf(".");
  const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  return join(dir, `${stem}.yml`);
}
