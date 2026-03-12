import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";

export function acquireLock(lockPath: string): boolean {
  if (isLocked(lockPath)) return false;
  writeFileSync(lockPath, String(process.pid));
  return true;
}

export function releaseLock(lockPath: string): void {
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
  }
}

export function isLocked(lockPath: string): boolean {
  return existsSync(lockPath);
}

export function cleanStaleLock(lockPath: string): void {
  if (!existsSync(lockPath)) return;

  const pid = parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
  if (isNaN(pid)) {
    unlinkSync(lockPath);
    return;
  }

  try {
    process.kill(pid, 0);
  } catch {
    unlinkSync(lockPath);
  }
}

export async function withLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  timeoutMs = 10_000
): Promise<T> {
  const start = Date.now();

  while (!acquireLock(lockPath)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Lock acquisition timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}
