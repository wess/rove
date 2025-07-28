import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import connect from "../../src/commands/connect";

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

// Mock readline
const mockPrompt = mock();
const mockClose = mock();
const mockOn = mock();

mock.module("node:readline", () => ({
  createInterface: mock().mockReturnValue({
    prompt: mockPrompt,
    close: mockClose,
    on: mockOn,
  }),
}));

describe("connect command", () => {
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
    mockPrompt.mockClear();
    mockClose.mockClear();
    mockOn.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it("should exit with error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    
    try {
      await connect();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "invalid-url";
    
    try {
      await connect();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when database name cannot be determined", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/";
    
    try {
      await connect();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when database connection fails", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection failed"));
    
    try {
      await connect();
    } catch (error) {
      expect(exitCode).toBe(1);
      expect(mockEnd).toHaveBeenCalled();
    }
  });

  it("should establish connection and setup REPL successfully", async () => {
    // Mock successful connection
    mockConnect.mockResolvedValueOnce({
      release: mockRelease,
    });
    
    // Mock readline interface setup
    mockOn.mockImplementation((event, callback) => {
      // Don't actually trigger events in test
      return;
    });
    
    await connect();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith("line", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Mock successful connection
    mockConnect.mockResolvedValueOnce({
      release: mockRelease,
    });
    
    mockOn.mockImplementation(() => {
      return;
    });
    
    await connect();
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should handle database connection test", async () => {
    // Mock successful connection
    mockConnect.mockResolvedValueOnce({
      release: mockRelease,
    });
    
    mockOn.mockImplementation(() => {
      return;
    });
    
    await connect();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });

  // Note: Testing the REPL functionality would require more complex mocking
  // of the readline interface and event handling. The core connection logic
  // is tested above, which covers the main functionality of the command.
});