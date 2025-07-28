import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import seed from "../../src/commands/seed";

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

describe("seed command", () => {
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
      await seed();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when DATABASE_URL is invalid", async () => {
    process.env.DATABASE_URL = "invalid-url";
    
    try {
      await seed();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should exit with error when database name cannot be determined", async () => {
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/";
    
    try {
      await seed();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should handle case when no tables exist", async () => {
    // Mock database responses
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No tables found
    
    await seed();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should seed tables with default count", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          },
          {
            column_name: "email",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce({ // Check existing count
        rows: [{ count: "0" }]
      });
    
    // Mock 10 insert queries (default count)
    for (let i = 0; i < 10; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [] });
    }
    
    await seed();
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("information_schema.tables")
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it("should seed tables with custom count", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce({ // Check existing count
        rows: [{ count: "0" }]
      });
    
    // Mock 5 insert queries (custom count)
    for (let i = 0; i < 5; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [] });
    }
    
    await seed({ count: 5 });
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should truncate tables when truncate option is enabled", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce(undefined) // TRUNCATE query
      .mockResolvedValueOnce({ rows: [] }); // INSERT query
    
    await seed({ count: 1, truncate: true });
    
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("TRUNCATE TABLE")
    );
  });

  it("should skip tables with existing data when truncate is false", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce({ // Check existing count
        rows: [{ count: "5" }] // Table has existing data
      });
    
    await seed({ count: 1, truncate: false });
    
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO")
    );
  });

  it("should handle tables with serial/auto-increment columns", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: "nextval('users_id_seq'::regclass)",
            character_maximum_length: null
          },
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce({ // Check existing count
        rows: [{ count: "0" }]
      })
      .mockResolvedValueOnce({ // INSERT query with RETURNING id
        rows: [{ id: 1 }]
      });
    
    await seed({ count: 1 });
    
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("RETURNING id"),
      expect.any(Array)
    );
  });

  it("should handle constraint violations gracefully", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "users" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns
        rows: [
          {
            column_name: "email",
            data_type: "text",
            is_nullable: "NO",
            column_default: null,
            character_maximum_length: 255
          }
        ]
      })
      .mockResolvedValueOnce({ // Check existing count
        rows: [{ count: "0" }]
      });
    
    // Mock constraint violation error
    const constraintError = new Error("duplicate key value violates unique constraint");
    constraintError.code = "23505";
    mockQuery.mockRejectedValueOnce(constraintError);
    
    await seed({ count: 1 });
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should work with POSTGRES_URL environment variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://test:test@localhost:5432/testdb";
    
    // Mock database responses
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No tables found
    
    await seed();
    
    expect(mockConnect).toHaveBeenCalled();
  });

  it("should handle database connection errors", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection failed"));
    
    try {
      await seed();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should handle general seeding errors", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Database error"));
    
    try {
      await seed();
    } catch (error) {
      expect(exitCode).toBe(1);
    }
  });

  it("should skip tables with no insertable columns", async () => {
    // Mock database responses
    mockQuery
      .mockResolvedValueOnce({ // Get tables
        rows: [{ table_name: "system_table" }]
      })
      .mockResolvedValueOnce({ // Get existing IDs
        rows: []
      })
      .mockResolvedValueOnce({ // Get columns - all have defaults
        rows: [
          {
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: "nextval('system_table_id_seq'::regclass)",
            character_maximum_length: null
          },
          {
            column_name: "created_at",
            data_type: "timestamp",
            is_nullable: "NO",
            column_default: "now()",
            character_maximum_length: null
          }
        ]
      });
    
    await seed({ count: 1 });
    
    expect(mockQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO")
    );
  });
});