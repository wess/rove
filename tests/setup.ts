// Test setup file for Rove tests
// This file runs before all tests and sets up common test utilities

import { beforeAll, afterAll } from "bun:test";

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";
  
  // Suppress console output during tests unless explicitly testing it
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Store original methods for restoration
  (global as any).__originalConsole = {
    log: originalConsoleLog,
    error: originalConsoleError,
    warn: originalConsoleWarn,
  };
});

afterAll(() => {
  // Restore original console methods if they were mocked
  if ((global as any).__originalConsole) {
    console.log = (global as any).__originalConsole.log;
    console.error = (global as any).__originalConsole.error;
    console.warn = (global as any).__originalConsole.warn;
  }
});

// Test utilities
export const testUtils = {
  // Helper to suppress console output during a test
  suppressConsole: () => {
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  },
  
  // Helper to restore console output
  restoreConsole: () => {
    if ((global as any).__originalConsole) {
      console.log = (global as any).__originalConsole.log;
      console.error = (global as any).__originalConsole.error;
      console.warn = (global as any).__originalConsole.warn;
    }
  },
  
  // Helper to create a mock database pool
  createMockPool: () => {
    const { mock } = require("bun:test");
    const mockQuery = mock();
    const mockConnect = mock();
    const mockRelease = mock();
    const mockEnd = mock();
    
    return {
      query: mockQuery,
      connect: mockConnect.mockResolvedValue({
        query: mockQuery,
        release: mockRelease,
      }),
      end: mockEnd.mockResolvedValue(undefined),
      // Expose mocks for testing
      _mocks: {
        query: mockQuery,
        connect: mockConnect,
        release: mockRelease,
        end: mockEnd,
      }
    };
  },
  
  // Helper to create temporary test directories
  createTempDir: async () => {
    const { tmpdir } = await import("node:os");
    const { mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    
    return mkdtempSync(join(tmpdir(), "rove-test-"));
  },
  
  // Helper to clean up temporary directories
  cleanupTempDir: async (dir: string) => {
    const { rmSync } = await import("node:fs");
    rmSync(dir, { recursive: true, force: true });
  },
};

// Export common test constants
export const TEST_DATABASE_URL = "postgres://test:test@localhost:5432/rove_test";
export const TEST_MIGRATION_NAME = "20240101T000000000Z_test_migration";
export const TEST_MIGRATION_SQL = "CREATE TABLE test_table (id SERIAL PRIMARY KEY);";