import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import down from "../../src/commands/down";

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

describe("down command", () => {
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
      await down();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should handle case when no migrations exist", async () => {
    // Mock database response - no migrations
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await down();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT name")
    );
    expect(mockRelease).toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
    
    // Function should return early when no migrations exist
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("should revert the last migration successfully", async () => {
    // Create migrations directory with test migration
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migrationName = "20240101T000000000Z_create_users";
    const migrationPath = path.join(migrationsDir, migrationName);
    fs.mkdirSync(migrationPath);
    
    // Create down.sql file
    fs.writeFileSync(
      path.join(migrationPath, "down.sql"),
      "DROP TABLE users;"
    );
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: migrationName }] }) // SELECT last migration
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // Execute down.sql
      .mockResolvedValueOnce(undefined) // DELETE migration record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await down();
    
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT name")
    );
    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith("DROP TABLE users;");
    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM migrations WHERE name = $1", [migrationName]);
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    
    // Verify the core database operations happened
    expect(mockQuery).toHaveBeenCalledTimes(5); // SELECT, BEGIN, DROP, DELETE, COMMIT
  });

  it("should handle migration without down.sql file", async () => {
    // Create migrations directory with test migration (no down.sql)
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migrationName = "20240101T000000000Z_create_users";
    const migrationPath = path.join(migrationsDir, migrationName);
    fs.mkdirSync(migrationPath);
    
    // Don't create down.sql file
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: migrationName }] }) // SELECT last migration
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // DELETE migration record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await down();
    
    // Should not execute any down SQL
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("DROP"));
    
    // Should still delete the migration record
    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM migrations WHERE name = $1", [migrationName]);
    expect(mockQuery).toHaveBeenCalledTimes(4); // SELECT, BEGIN, DELETE, COMMIT
  });

  it("should rollback on error", async () => {
    // Create migrations directory with test migration
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migrationName = "20240101T000000000Z_create_users";
    const migrationPath = path.join(migrationsDir, migrationName);
    fs.mkdirSync(migrationPath);
    
    // Create down.sql file with invalid SQL
    fs.writeFileSync(
      path.join(migrationPath, "down.sql"),
      "INVALID SQL STATEMENT;"
    );
    
    // Mock database responses - error on down SQL execution
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: migrationName }] }) // SELECT last migration
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockImplementationOnce(() => Promise.reject(new Error("SQL syntax error"))) // Execute down.sql (fails)
      .mockResolvedValueOnce(undefined); // ROLLBACK
    
    const consoleErrorSpy = mock(console, "error");
    
    try {
      await down();
    } catch (error) {
      expect(exitCode).toBe(1);
      expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error reverting migration")
      );
    }
    
    consoleErrorSpy.mockRestore();
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Mock database response - no migrations
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await down();
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should handle empty down.sql file", async () => {
    // Create migrations directory with test migration
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migrationName = "20240101T000000000Z_create_users";
    const migrationPath = path.join(migrationsDir, migrationName);
    fs.mkdirSync(migrationPath);
    
    // Create empty down.sql file
    fs.writeFileSync(path.join(migrationPath, "down.sql"), "   \n  \t  ");
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ rows: [{ name: migrationName }] }) // SELECT last migration
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // DELETE migration record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await down();
    
    // Should not execute any SQL since file is empty after trim
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("DROP"));
    
    // Should still delete the migration record
    expect(mockQuery).toHaveBeenCalledWith("DELETE FROM migrations WHERE name = $1", [migrationName]);
    expect(mockQuery).toHaveBeenCalledTimes(4); // SELECT, BEGIN, DELETE, COMMIT
  });

  it("should handle database connection errors", async () => {
    // Mock connection error
    mockConnect.mockRejectedValueOnce(new Error("Connection failed"));
    
    try {
      await down();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Connection failed");
    }
  });
});