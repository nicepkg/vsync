import { readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { atomicWrite } from "./atomic-write.js";
import * as fileOps from "./file-ops.js";

export async function readSupportFiles(
  rootDir: string,
  options?: { exclude?: (relativePath: string) => boolean },
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await readSupportFilesRecursive(rootDir, rootDir, result, options?.exclude);
  return result;
}

async function readSupportFilesRecursive(
  currentDir: string,
  rootDir: string,
  result: Record<string, string>,
  exclude?: (relativePath: string) => boolean,
): Promise<void> {
  const entries = await fileOps.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, fullPath).split(sep).join("/");

    if (entry.isDirectory()) {
      await readSupportFilesRecursive(fullPath, rootDir, result, exclude);
      continue;
    }

    if (exclude?.(relativePath)) {
      continue;
    }

    const content = await readFile(fullPath, "utf-8");
    result[relativePath] = content;
  }
}

export async function writeSupportFiles(
  rootDir: string,
  supportFiles?: Record<string, string>,
): Promise<void> {
  if (!supportFiles) {
    return;
  }

  for (const [relativePath, content] of Object.entries(supportFiles)) {
    const filePath = join(rootDir, relativePath);
    await fileOps.ensureDir(dirname(filePath));
    await atomicWrite(filePath, content);
  }
}
