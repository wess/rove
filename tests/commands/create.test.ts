import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import create from "../../src/commands/create";

// Mock pg Pool
const mockQuery = mock();
const mockEnd = mock();

mock.module("pg", () => ({
  Pool: mock().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd.mockResolvedValue(undefined),
  })),
}));

describe("create command", () => {
  let originalEnv: typeof process.env;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalExit = process.exit;
    
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Mock process.exit
    exitCode = undefined;
    process.exit = mock((code?: number) => {
      exitCode = code;
      // Throw to stop execution like real process.exit would
      throw new Error(`Process exit called with code ${code}`);
    }) as any;

    // Reset mocks
    mockQuery.mockClear();
    mockEnd.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it("should exit with error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    
    try {
      await create();
    } catch (error) {
      // Expected - process.exit throws in our mock
    }
    
    expect(exitCode).toBe(1);
  });

  it("should exit with error when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "invalid-url";
    
    try {
      await create();
    } catch (error) {
      // Expected - process.exit throws in our mock
    }
    
    expect(exitCode).toBe(1);
  });

  it("should exit with error when database name cannot be determined", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/";
    
    try {
      await create();
    } catch (error) {
      // Expected - process.exit throws in our mock
    }
    
    expect(exitCode).toBe(1);
  });

  it("should create database successfully", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await create();
    
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "testdb"');
    expect(mockEnd).toHaveBeenCalled();
    expect(exitCode).toBeUndefined(); // Should not exit with error
  });

  it("should handle database already exists error", async () => {
    const error = new Error("database already exists") as any;
    error.code = "42P04";
    mockQuery.mockImplementationOnce(() => Promise.reject(error));
    
    await create();
    
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "testdb"');
    expect(mockEnd).toHaveBeenCalled();
    expect(exitCode).toBeUndefined(); // Should not exit with error for already exists
  });

  it("should handle database already exists error with message check", async () => {
    const error = new Error("Database testdb already exists");
    mockQuery.mockImplementationOnce(() => Promise.reject(error));
    
    await create();
    
    expect(mockEnd).toHaveBeenCalled();
    expect(exitCode).toBeUndefined(); // Should not exit with error for already exists
  });

  it("should exit with error on other database errors", async () => {
    const error = new Error("Connection failed");
    mockQuery.mockImplementationOnce(() => Promise.reject(error));
    
    try {
      await create();
    } catch (error) {
      // Expected - process.exit throws in our mock
    }
    
    expect(exitCode).toBe(1);
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await create();
    
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "testdb"');
  });

  it("should handle database names with special characters", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test-db_123";
    
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await create();
    
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "test-db_123"');
    expect(mockEnd).toHaveBeenCalled();
    expect(exitCode).toBeUndefined(); // Should not exit with error
  });

  it("should properly clean up pool on success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await create();
    
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should properly clean up pool on error", async () => {
    const error = new Error("Connection failed");
    mockQuery.mockImplementationOnce(() => Promise.reject(error));
    
    try {
      await create();
    } catch (error) {
      // Expected - process.exit throws in our mock
    }
    
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should handle URL parsing edge cases", async () => {
    // Test with port in URL
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/mydb?sslmode=require";
    
    mockQuery.mockResolvedValueOnce({ rows: [] });
    
    await create();
    
    expect(mockQuery).toHaveBeenCalledWith('CREATE DATABASE "mydb"');
  });
});