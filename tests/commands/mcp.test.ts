import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import mcp from "../../src/commands/mcp";

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
    query: mockQuery,
  })),
}));

// Mock MCP SDK
const mockSetRequestHandler = mock();
const mockServerConnect = mock();

mock.module("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: mock().mockImplementation(() => ({
    setRequestHandler: mockSetRequestHandler,
    connect: mockServerConnect.mockResolvedValue(undefined),
  })),
}));

mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: mock().mockImplementation(() => ({})),
}));

mock.module("@modelcontextprotocol/sdk/server/sse.js", () => ({
  SSEServerTransport: mock().mockImplementation(() => ({})),
}));

describe("mcp command", () => {
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
    mockSetRequestHandler.mockClear();
    mockServerConnect.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    process.exit = originalExit;
  });

  it("should exit with error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    
    try {
      await mcp();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should start MCP server in stdio mode by default", async () => {
    await mcp();
    
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(4); // ListTools, CallTool, ListResources, ReadResource
    expect(mockServerConnect).toHaveBeenCalled();
  });

  it("should start MCP server in HTTP mode when port is provided", async () => {
    // Mock HTTP server creation
    const mockListen = mock();
    const mockCreateServer = mock().mockReturnValue({
      listen: mockListen,
    });
    
    mock.module("node:http", () => ({
      createServer: mockCreateServer,
    }));
    
    await mcp({ port: 3000, host: "localhost" });
    
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(4);
    expect(mockCreateServer).toHaveBeenCalled();
    expect(mockListen).toHaveBeenCalledWith(3000, "localhost");
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    await mcp();
    
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(4);
    expect(mockServerConnect).toHaveBeenCalled();
  });

  it("should use default host when not provided", async () => {
    // Mock HTTP server creation
    const mockListen = mock();
    const mockCreateServer = mock().mockReturnValue({
      listen: mockListen,
    });
    
    mock.module("node:http", () => ({
      createServer: mockCreateServer,
    }));
    
    await mcp({ port: 3000 });
    
    expect(mockListen).toHaveBeenCalledWith(3000, "localhost");
  });
});