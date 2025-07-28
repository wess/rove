import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import run from "../../src/commands/run";

// Mock pg Pool
const mockQuery = mock();
const mockConnect = mock();
const mockRelease = mock();
const mockEnd = mock();

mock.module("pg", () => ({
  Pool: mock().mockImplementation(() => ({
    connect: mockConnect.mockResolvedValue({
      release: mockRelease,
    }),
    query: mockQuery,
    end: mockEnd.mockResolvedValue(undefined),
  })),
}));

describe("run command", () => {
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
    mockConnect.mockClear();
    mockRelease.mockClear();
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
      await run();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "invalid-url";
    
    try {
      await run();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when database name cannot be determined", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/";
    
    try {
      await run();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when no query is specified", async () => {
    try {
      await run();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should execute SELECT query successfully", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" }
      ],
      rowCount: 2
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT * FROM users");
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM users;");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should execute INSERT query successfully", async () => {
    const mockResult = {
      command: "INSERT",
      rows: [],
      rowCount: 1
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("INSERT INTO users (name) VALUES ('Test')");
    
    expect(mockQuery).toHaveBeenCalledWith("INSERT INTO users (name) VALUES ('Test');");
  });

  it("should handle query with --query flag", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run(undefined, { query: "SELECT 1" });
    
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1;");
  });

  it("should handle --show-tables flag", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [
        { table_name: "users", table_type: "BASE TABLE" },
        { table_name: "posts", table_type: "BASE TABLE" }
      ],
      rowCount: 2
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run(undefined, { showTables: true });
    
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.tables")
    );
  });

  it("should add semicolon to query if missing", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT 1");
    
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1;");
  });

  it("should not add semicolon if already present", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT 1;");
    
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1;");
  });

  it("should handle empty result set", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT * FROM empty_table");
    
    expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM empty_table;");
  });

  it("should handle database connection errors", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection failed"));
    
    try {
      await run("SELECT 1");
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should handle SQL execution errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("SQL syntax error"));
    
    try {
      await run("INVALID SQL");
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT 1");
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should prioritize --query flag over positional argument", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT 2", { query: "SELECT 1" });
    
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1;");
  });

  it("should prioritize --show-tables over other options", async () => {
    const mockResult = {
      command: "SELECT",
      rows: [],
      rowCount: 0
    };
    
    mockQuery.mockResolvedValueOnce(mockResult);
    
    await run("SELECT 2", { showTables: true, query: "SELECT 1" });
    
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.tables")
    );
  });
});