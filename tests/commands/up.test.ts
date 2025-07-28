import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import up from "../../src/commands/up";

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

describe("up command", () => {
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
      await up();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when migrations directory doesn't exist", async () => {
    try {
      await up();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should create migrations table and apply pending migrations", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Create up.sql files
    fs.writeFileSync(
      path.join(migration1, "up.sql"),
      "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);"
    );
    fs.writeFileSync(
      path.join(migration2, "up.sql"),
      "ALTER TABLE users ADD COLUMN email TEXT;"
    );
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // CREATE TABLE migrations
      .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
      .mockResolvedValueOnce(undefined) // Execute migration1 SQL
      .mockResolvedValueOnce(undefined) // INSERT migration1 record
      .mockResolvedValueOnce(undefined) // Execute migration2 SQL
      .mockResolvedValueOnce(undefined) // INSERT migration2 record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await up();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS migrations")
    );
    expect(mockQuery).toHaveBeenCalledWith("SELECT name FROM migrations");
    expect(mockQuery).toHaveBeenCalledWith("CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);");
    expect(mockQuery).toHaveBeenCalledWith("ALTER TABLE users ADD COLUMN email TEXT;");
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should skip already applied migrations", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Create up.sql files
    fs.writeFileSync(
      path.join(migration1, "up.sql"),
      "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);"
    );
    fs.writeFileSync(
      path.join(migration2, "up.sql"),
      "ALTER TABLE users ADD COLUMN email TEXT;"
    );
    
    // Mock database responses - migration1 already applied
    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // CREATE TABLE migrations
      .mockResolvedValueOnce({ 
        rows: [{ name: "20240101T000000000Z_create_users" }] 
      }) // SELECT applied migrations
      .mockResolvedValueOnce(undefined) // Execute migration2 SQL
      .mockResolvedValueOnce(undefined) // INSERT migration2 record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await up();
    
    // Should only apply migration2
    expect(mockQuery).toHaveBeenCalledWith("ALTER TABLE users ADD COLUMN email TEXT;");
    expect(mockQuery).toHaveBeenCalledWith("INSERT INTO migrations (name) VALUES ($1)", ["20240102T000000000Z_add_email"]);
    
    // Should not apply migration1 again
    expect(mockQuery).not.toHaveBeenCalledWith("CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);");
    expect(mockQuery).not.toHaveBeenCalledWith("INSERT INTO migrations (name) VALUES ($1)", ["20240101T000000000Z_create_users"]);
  });

  it("should skip migrations without up.sql file", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    const migration2 = path.join(migrationsDir, "20240102T000000000Z_add_email");
    fs.mkdirSync(migration1);
    fs.mkdirSync(migration2);
    
    // Only create up.sql for migration2
    fs.writeFileSync(
      path.join(migration2, "up.sql"),
      "ALTER TABLE users ADD COLUMN email TEXT;"
    );
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // CREATE TABLE migrations
      .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
      .mockResolvedValueOnce(undefined) // Execute migration2 SQL
      .mockResolvedValueOnce(undefined) // INSERT migration2 record
      .mockResolvedValueOnce(undefined); // COMMIT
    
    await up();
    
    expect(mockQuery).toHaveBeenCalledWith("ALTER TABLE users ADD COLUMN email TEXT;");
  });

  it("should rollback on error", async () => {
    // Create migrations directory with test migrations
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    const migration1 = path.join(migrationsDir, "20240101T000000000Z_create_users");
    fs.mkdirSync(migration1);
    
    fs.writeFileSync(
      path.join(migration1, "up.sql"),
      "INVALID SQL STATEMENT;"
    );
    
    // Mock database responses - error on migration execution
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE migrations
      .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
      .mockImplementationOnce(() => Promise.reject(new Error("SQL syntax error"))) // Execute migration SQL (fails)
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    
    // The up function calls process.exit(1) on error
    await up();
    
    expect(exitCode).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith("ROLLBACK");
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Create migrations directory
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE migrations
      .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    
    // This should succeed without calling process.exit
    await up();
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should handle empty migrations directory", async () => {
    // Create empty migrations directory
    const migrationsDir = path.join(testDir, "migrations");
    fs.mkdirSync(migrationsDir);
    
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN (needs to return an object)
      .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE migrations
      .mockResolvedValueOnce({ rows: [] }) // SELECT applied migrations
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    
    await up();
    
    expect(mockQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockQuery).toHaveBeenCalledWith("COMMIT");
    // No migration-specific queries should be called
    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO migrations"));
  });
});