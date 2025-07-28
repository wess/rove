import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Pool } from "pg";

// Database connection setup
const createDatabasePool = (envUrl: string) => new Pool({ connectionString: envUrl });

// Tool handlers (pure functions)
const handleQueryTool = async (pool: Pool, args: { sql: string }) => {
  const { sql } = args;
  const result = await pool.query(sql);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields?.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          },
          null,
          2,
        ),
      },
    ],
  };
};

const handleDescribeTableTool = async (pool: Pool, args: { table_name: string }) => {
  const { table_name } = args;
  const result = await pool.query(
    `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = $1 
      AND table_schema = 'public'
    ORDER BY ordinal_position;
  `,
    [table_name],
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.rows, null, 2),
      },
    ],
  };
};

const handleListTablesTool = async (pool: Pool) => {
  const result = await pool.query(`
    SELECT 
      table_name,
      table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.rows, null, 2),
      },
    ],
  };
};

// Resource handlers (pure functions)
const handleSchemaResource = async (pool: Pool) => {
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  const schema: Record<string, any> = {};

  for (const table of tablesResult.rows) {
    const columnsResult = await pool.query(
      `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = $1 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `,
      [table.table_name],
    );

    schema[table.table_name] = columnsResult.rows;
  }

  return {
    contents: [
      {
        uri: "postgres://schema",
        mimeType: "application/json",
        text: JSON.stringify(schema, null, 2),
      },
    ],
  };
};

const handleMigrationsResource = async (pool: Pool) => {
  const result = await pool.query(`
    SELECT name, run_on 
    FROM migrations 
    ORDER BY run_on DESC;
  `);

  return {
    contents: [
      {
        uri: "postgres://migrations",
        mimeType: "application/json",
        text: JSON.stringify(result.rows, null, 2),
      },
    ],
  };
};

// Configuration
const getToolsConfig = () => [
  {
    name: "query",
    description: "Execute a SQL query on the PostgreSQL database",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "The SQL query to execute",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "describe_table",
    description: "Describe the structure of a table",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "The name of the table to describe",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "list_tables",
    description: "List all tables in the database",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

const getResourcesConfig = () => [
  {
    uri: "postgres://schema",
    mimeType: "application/json",
    name: "Database Schema",
    description: "Complete database schema information",
  },
  {
    uri: "postgres://migrations",
    mimeType: "application/json",
    name: "Migration Status",
    description: "Current migration status",
  },
];

// Tool dispatcher (functional approach)
const dispatchToolCall = async (pool: Pool, name: string, args: any) => {
  const toolHandlers = {
    query: (args: { sql: string }) => handleQueryTool(pool, args),
    describe_table: (args: { table_name: string }) => handleDescribeTableTool(pool, args),
    list_tables: () => handleListTablesTool(pool),
  };

  const handler = toolHandlers[name as keyof typeof toolHandlers];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return handler(args);
};

// Resource dispatcher (functional approach)
const dispatchResourceRead = async (pool: Pool, uri: string) => {
  const resourceHandlers = {
    "postgres://schema": () => handleSchemaResource(pool),
    "postgres://migrations": () => handleMigrationsResource(pool),
  };

  const handler = resourceHandlers[uri as keyof typeof resourceHandlers];
  if (!handler) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  return handler();
};

// Server setup (functional wrapper around class)
const setupMcpServer = (pool: Pool) => {
  const server = new Server(
    {
      name: "rove-postgres-mcp",
      version: "0.0.1",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  // Register handlers functionally
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolsConfig(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await dispatchToolCall(pool, name, args);
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: getResourcesConfig(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    try {
      return await dispatchResourceRead(pool, uri);
    } catch (error) {
      throw new Error(
        `Failed to read resource ${uri}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  return server;
};

// Transport creation functions
const createStdioTransport = () => new StdioServerTransport();

// HTTP server creation (functional)
const createHttpServer = async (server: Server, port: number, host: string) => {
  const http = await import("node:http");
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = http.createServer((req, res) => {
    // Set CORS headers for all responses
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === "/message" && req.method === "GET") {
      // Create transport for this SSE connection
      const transport = new SSEServerTransport("/message", res);

      // Store transport with a unique key (could use connection ID)
      const connectionId = `${Date.now()}-${Math.random()}`;
      transports.set(connectionId, transport);

      // Clean up transport when connection closes
      res.on("close", () => {
        transports.delete(connectionId);
      });

      server.connect(transport).catch(console.error);
    } else if (req.url?.startsWith("/message") && req.method === "POST") {
      // Extract session ID from URL parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = url.searchParams.get("sessionId");

      if (sessionId) {
        // Find transport by session ID
        const transport = Array.from(transports.values()).find((t) => t.sessionId === sessionId);
        if (transport) {
          transport.handlePostMessage(req, res);
        } else {
          res.writeHead(500);
          res.end("SSE connection not found for session");
        }
      } else {
        res.writeHead(400);
        res.end("Missing sessionId parameter");
      }
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  httpServer.listen(port, host);
  return httpServer;
};

// Logging functions
const logServerStart = (mode: "http" | "stdio", host?: string, port?: number) => {
  console.error("🚀 Rove MCP Server Started");

  if (mode === "http" && host && port) {
    console.error(`   URL: http://${host}:${port}`);
    console.error("   Transport: HTTP (Server-Sent Events)");
  } else {
    console.error("   Transport: stdio (standard input/output)");
  }

  console.error("   Database: Connected to PostgreSQL");
  console.error("   Tools: query, describe_table, list_tables");
  console.error("   Resources: schema, migrations");
  console.error("");
  console.error("💡 To stop the server: Press Ctrl+C");

  if (mode === "stdio") {
    console.error("📄 For Claude Desktop config:");
    console.error(`   Add to claude_desktop_config.json:`);
    console.error(`   "rove": {`);
    console.error(`     "command": "rove",`);
    console.error(`     "args": ["mcp"]`);
    console.error(`   }`);
  }

  console.error("");
};

// Main function (pure functional approach)
export default async function mcp(options: { port?: number; host?: string } = {}): Promise<void> {
  // Get DATABASE_URL from environment
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️  Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // Create database connection
  const pool = createDatabasePool(envUrl);

  // Setup MCP server
  const server = setupMcpServer(pool);

  // Handle transport and server startup
  const { port, host = "localhost" } = options;

  if (port) {
    // HTTP mode
    logServerStart("http", host, port);
    await createHttpServer(server, port, host);
  } else {
    // Stdio mode
    const transport = createStdioTransport();
    logServerStart("stdio");
    await server.connect(transport);
  }
}
