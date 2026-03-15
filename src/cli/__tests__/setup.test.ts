import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { detectSkills, copySkills } from "../setup";

const TEST_DIR = "/tmp/octowiki-test-setup";
const GLOBAL_DIR = join(TEST_DIR, "global/.claude/skills");
const LOCAL_DIR = join(TEST_DIR, "local/.claude/skills");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, "global"), { recursive: true });
  mkdirSync(join(TEST_DIR, "local"), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("detectSkills", () => {
  test("returns null when no skills installed", () => {
    const result = detectSkills(GLOBAL_DIR, LOCAL_DIR);
    expect(result).toBeNull();
  });

  test("detects global installation", () => {
    mkdirSync(join(GLOBAL_DIR, "octowiki-add-page"), { recursive: true });
    Bun.write(join(GLOBAL_DIR, "octowiki-add-page/SKILL.md"), "test");
    const result = detectSkills(GLOBAL_DIR, LOCAL_DIR);
    expect(result).toBe("global");
  });

  test("detects local installation", () => {
    mkdirSync(join(LOCAL_DIR, "octowiki-add-page"), { recursive: true });
    Bun.write(join(LOCAL_DIR, "octowiki-add-page/SKILL.md"), "test");
    const result = detectSkills(GLOBAL_DIR, LOCAL_DIR);
    expect(result).toBe("local");
  });
});

describe("copySkills", () => {
  test("copies all three skill directories", () => {
    copySkills(LOCAL_DIR);
    expect(existsSync(join(LOCAL_DIR, "octowiki-add-page/SKILL.md"))).toBe(true);
    expect(existsSync(join(LOCAL_DIR, "octowiki-batch-import/SKILL.md"))).toBe(true);
    expect(existsSync(join(LOCAL_DIR, "octowiki-invariants/SKILL.md"))).toBe(true);
  });

  test("skill content is non-empty", () => {
    copySkills(LOCAL_DIR);
    const content = readFileSync(join(LOCAL_DIR, "octowiki-add-page/SKILL.md"), "utf-8");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("octowiki-add-page");
  });
});
