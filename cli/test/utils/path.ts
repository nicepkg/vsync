import path from "node:path";

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function resolveNormalizedPath(value: string): string {
  return normalizePath(path.resolve(value));
}
