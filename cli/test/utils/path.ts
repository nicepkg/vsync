import path from "node:path";

export function normalizePath(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function resolveNormalizedPath(value: string): string {
  return normalizePath(path.resolve(value));
}

export function isSamePath(actual: string, expected: string): boolean {
  return resolveNormalizedPath(actual) === resolveNormalizedPath(expected);
}
