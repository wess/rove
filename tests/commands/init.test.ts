import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import init from "../../src/commands/init";

describe("init command", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(tmpdir(), "rove-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create migrations directory when it doesn't exist", () => {
    const migrationsDir = path.join(testDir, "migrations");
    
    // Ensure directory doesn't exist
    expect(fs.existsSync(migrationsDir)).toBe(false);
    
    // Run init command
    init();
    
    // Check that directory was created
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.statSync(migrationsDir).isDirectory()).toBe(true);
  });

  it("should handle existing migrations directory gracefully", () => {
    const migrationsDir = path.join(testDir, "migrations");
    
    // Pre-create the directory
    fs.mkdirSync(migrationsDir);
    expect(fs.existsSync(migrationsDir)).toBe(true);
    
    // Run init command - should not throw
    expect(() => init()).not.toThrow();
    
    // Directory should still exist
    expect(fs.existsSync(migrationsDir)).toBe(true);
  });

  it("should create migrations directory with correct permissions", () => {
    const migrationsDir = path.join(testDir, "migrations");
    
    init();
    
    const stats = fs.statSync(migrationsDir);
    expect(stats.isDirectory()).toBe(true);
    
    // Check that we can write to the directory
    const testFile = path.join(migrationsDir, "test.txt");
    expect(() => fs.writeFileSync(testFile, "test")).not.toThrow();
    fs.unlinkSync(testFile);
  });
});