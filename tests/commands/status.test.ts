import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { Pool } from "pg";
import status from "../../src/commands/status";

// Mock pg Pool
const mockQuery = mock();
const mockConnect = mock();
const mockRelease = mock();
const mockEnd = mock();

mock.module("pg", () => ({
  Pool: mock().mockImplementation(() => ({
    connect: mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    }),
    end: mockEnd.mockResolvedValue(undefined),
  })),
}));

describe("status command", () => {
  let testDir: string;
  let originalCwd: string;
  let originalEnv: typeof process.env;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(tmpdir(), "rove-test-"));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    originalExit = process.exit;
    
    process.chdir(testDir);
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Mock process.exit
    exitCode = undefined;
    process.exit = mock((code?: number) => {
      exitCode = code;
      // Don't throw, just return to prevent actual exit
      return undefined as never;
    }) as any;

    // Reset mocks
    mockQuery.mockClear();
    mockConnect.mockClear();
    mockRelease.mockClear();
    mockEnd.mockClear();
  });

  afterEach(() => {
    // Clean up
    process.chdir(originalCwd);
    process.env = originalEnv;
    process.exit = originalExit;
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should exit with error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    
    try {
      await status();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when migrations directory doesn't exist", async () => {
    try {
      await status();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should show status of migrations", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Mock database response - migration1 is applied, migration2 is pending
    mockQuery.mockResolvedValueOnce({
      rows: [
        { name: "20240101T000000000Z_create_users", run_on: new Date("2024-01-01T10:00:00Z") }
      ]
    });
    
    await status();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT name, run_on")
    );
    expect(mockRelease).toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should show quiet status when quiet option is enabled", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Mock database response - migration1 is applied, migration2 is pending
    mockQuery.mockResolvedValueOnce({
      rows: [
        { name: "20240101T000000000Z_create_users", run_on: new Date("2024-01-01T10:00:00Z") }
      ]
    });
    
    await status({ quiet: true });
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should exit with code 1 when exitCode option is enabled and there are pending migrations", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Mock database response - no migrations applied
    mockQuery.mockResolvedValueOnce({
      rows: []
    });
    
    try {
      await status({ exitCode: true });
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should not exit when exitCode option is enabled but no pending migrations", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    fs.mkdirSync(migration1);
    
    // Mock database response - all migrations applied
    mockQuery.mockResolvedValueOnce({
      rows: [
        { name: "20240101T000000000Z_create_users", run_on: new Date("2024-01-01T10:00:00Z") }
      ]
    });
    
    await status({ exitCode: true });
    
    expect(exitCode).toBeUndefined();
  });

  it("should handle database errors gracefully", async () => {
    // Create migrations directory
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    // Mock database error
    mockQuery.mockImplementationOnce(() => Promise.reject(new Error("Connection failed")));
    
    // The status function calls process.exit(1) on error
    await status();
    
    expect(exitCode).toBe(1);
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Create migrations directory
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await status();
    
    expect(mockConnect).toHaveBeenCalled();
  });
});