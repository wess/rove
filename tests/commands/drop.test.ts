import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import drop from "../../src/commands/drop";

// Mock pg Pool
const mockQuery = mock();
const mockEnd = mock();

mock.module("pg", () => ({
  Pool: mock().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd.mockResolvedValue(undefined),
  })),
}));

describe("drop command", () => {
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
      await drop();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "invalid-url";
    
    try {
      await drop();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when database name cannot be determined", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/";
    
    try {
      await drop();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should drop database successfully", async () => {
    mockQuery.mockResolvedValueOnce(undefined);
    
    await drop();
    
    expect(mockQuery).toHaveBeenCalledWith('DROP DATABASE "testdb"');
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should handle database does not exist error", async () => {
    const error = new Error("database does not exist");
    error.code = "3D000";
    mockQuery.mockRejectedValueOnce(error);
    
    await drop();
    
    expect(mockQuery).toHaveBeenCalledWith('DROP DATABASE "testdb"');
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should handle database does not exist error with message check", async () => {
    const error = new Error("Database testdb does not exist");
    mockQuery.mockRejectedValueOnce(error);
    
    await drop();
    
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should exit with error on other database errors", async () => {
    const error = new Error("Connection failed");
    mockQuery.mockRejectedValueOnce(error);
    
    try {
      await drop();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    mockQuery.mockResolvedValueOnce(undefined);
    
    await drop();
    
    expect(mockQuery).toHaveBeenCalledWith('DROP DATABASE "testdb"');
  });

  it("should handle database names with special characters", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test-db_123";
    
    mockQuery.mockResolvedValueOnce(undefined);
    
    await drop();
    
    expect(mockQuery).toHaveBeenCalledWith('DROP DATABASE "test-db_123"');
  });

  it("should properly clean up pool on success", async () => {
    mockQuery.mockResolvedValueOnce(undefined);
    
    await drop();
    
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should properly clean up pool on error", async () => {
    const error = new Error("Connection failed");
    mockQuery.mockRejectedValueOnce(error);
    
    try {
      await drop();
    } catch (error) {
      expect(mockEnd).toHaveBeenCalled();
    }
  });
});