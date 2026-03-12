import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { acquireLock, releaseLock, isLocked, cleanStaleLock } from "../lock";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const TEST_DIR = "/tmp/octowiki-test-lock";
const LOCK_PATH = join(TEST_DIR, "agent-writing.lock");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("lock management", () => {
  test("acquires and releases lock", () => {
    expect(isLocked(LOCK_PATH)).toBe(false);
    const acquired = acquireLock(LOCK_PATH);
    expect(acquired).toBe(true);
    expect(isLocked(LOCK_PATH)).toBe(true);
    releaseLock(LOCK_PATH);
    expect(isLocked(LOCK_PATH)).toBe(false);
  });

  test("cannot acquire lock twice", () => {
    acquireLock(LOCK_PATH);
    const second = acquireLock(LOCK_PATH);
    expect(second).toBe(false);
    releaseLock(LOCK_PATH);
  });

  test("cleanStaleLock removes lock with dead PID", () => {
    writeFileSync(LOCK_PATH, "999999999");
    expect(isLocked(LOCK_PATH)).toBe(true);
    cleanStaleLock(LOCK_PATH);
    expect(isLocked(LOCK_PATH)).toBe(false);
  });
});
