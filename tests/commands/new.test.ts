import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import newCmd from "../../src/commands/new";

describe("new command", () => {
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

  it("should create migrations directory if it doesn't exist", () => {
    const migrationsDir = path.join(testDir, "migrations");
    expect(fs.existsSync(migrationsDir)).toBe(false);
    
    newCmd("create_users");
    
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.statSync(migrationsDir).isDirectory()).toBe(true);
  });

  it("should create timestamped migration directory", () => {
    const migrationName = "create_users";
    
    newCmd(migrationName);
    
    const migrationsDir = path.join(testDir, "migrations");
    const entries = fs.readdirSync(migrationsDir);
    
    expect(entries).toHaveLength(1);
    
    const migrationDir = entries[0];
    expect(migrationDir).toMatch(new RegExp(`\\d{17}_${migrationName}`));
    
    const fullMigrationPath = path.join(migrationsDir, migrationDir);
    expect(fs.statSync(fullMigrationPath).isDirectory()).toBe(true);
  });

  it("should create up.sql and down.sql files", () => {
    const migrationName = "create_users";
    
    newCmd(migrationName);
    
    const migrationsDir = path.join(testDir, "migrations");
    const entries = fs.readdirSync(migrationsDir);
    const migrationDir = path.join(migrationsDir, entries[0]);
    
    const upFile = path.join(migrationDir, "up.sql");
    const downFile = path.join(migrationDir, "down.sql");
    
    expect(fs.existsSync(upFile)).toBe(true);
    expect(fs.existsSync(downFile)).toBe(true);
    
    const upContent = fs.readFileSync(upFile, "utf-8");
    const downContent = fs.readFileSync(downFile, "utf-8");
    
    expect(upContent).toBe("-- Write your UP migration SQL here\n");
    expect(downContent).toBe("-- Write your DOWN migration SQL here\n");
  });

  it("should handle migration names with special characters", () => {
    const migrationName = "add-user-email_index";
    
    newCmd(migrationName);
    
    const migrationsDir = path.join(testDir, "migrations");
    const entries = fs.readdirSync(migrationsDir);
    
    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain(migrationName);
  });

  it("should create unique timestamps for consecutive migrations", async () => {
    newCmd("first_migration");
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    newCmd("second_migration");
    
    const migrationsDir = path.join(testDir, "migrations");
    const entries = fs.readdirSync(migrationsDir).sort();
    
    expect(entries).toHaveLength(2);
    expect(entries[0]).not.toBe(entries[1]);
    expect(entries[0]).toContain("first_migration");
    expect(entries[1]).toContain("second_migration");
  });

  it("should work when migrations directory already exists", () => {
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    // Create an existing migration
    const existingMigration = path.join(migrationsDir, "20240101T000000000Z_existing");
    fs.mkdirSync(existingMigration);
    
    newCmd("new_migration");
    
    const entries = fs.readdirSync(migrationsDir);
    expect(entries).toHaveLength(2);
    expect(entries).toContain("20240101T000000000Z_existing");
    expect(entries.some(entry => entry.includes("new_migration"))).toBe(true);
  });
});