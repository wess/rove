import { Pool } from "pg";
import * as readline from "readline";

export default async function connectDb(): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️  Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Parse the URL to get database name for display
  let parsed: URL;
  try {
    parsed = new URL(envUrl);
  } catch {
    console.error("⚠️  Invalid DATABASE_URL format");
    process.exit(1);
  }

  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) {
    console.error("⚠️  Could not determine database name from URL");
    process.exit(1);
  }

  // 3) Create a connection pool
  const pool = new Pool({ connectionString: envUrl });

  // Test connection
  try {
    const client = await pool.connect();
    console.log(`✔ Connected to database "${dbName}"`);
    client.release();
  } catch (err: any) {
    console.error("❌ Error connecting to database:", err.message || err);
    await pool.end();
    process.exit(1);
  }

  // 4) Create readline interface for REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${dbName}=> `,
    terminal: true,
  });

  console.log("Welcome to Rove SQL REPL");
  console.log("Enter SQL queries to execute them (terminate with semicolon)");
  console.log("Type '/help' to see available commands");
  console.log("Type '/exit' to quit");
  console.log("");

  rl.prompt();

  let buffer = "";

  // Helper function to execute common meta-commands
  async function executeMetaCommand(command: string): Promise<boolean> {
    // List tables
    if (command === "\\dt" || command === "/list tables" || command === "/tables") {
      try {
        const query = `
          SELECT 
            table_schema, 
            table_name, 
            table_type 
          FROM 
            information_schema.tables 
          WHERE 
            table_schema NOT IN ('pg_catalog', 'information_schema') 
          ORDER BY 
            table_schema, table_name;
        `;
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
          console.log("No tables found.");
        } else {
          console.log("Tables");
          console.log("Schema | Name | Type");
          console.log("-------|------|------");
          result.rows.forEach(row => {
            console.log(`${row.table_schema} | ${row.table_name} | ${row.table_type}`);
          });
          console.log(`(${result.rows.length} ${result.rows.length === 1 ? "table" : "tables"})`);
        }
        return true;
      } catch (err: any) {
        console.error("Error listing tables:", err.message || err);
        return true;
      }
    }

    // List schemas
    if (command === "\\dn" || command === "/list schemas" || command === "/schemas") {
      try {
        const query = `
          SELECT 
            schema_name,
            schema_owner
          FROM 
            information_schema.schemata
          WHERE 
            schema_name NOT IN ('pg_catalog', 'information_schema')
          ORDER BY 
            schema_name;
        `;
        const result = await pool.query(query);
        
        if (result.rows.length === 0) {
          console.log("No schemas found.");
        } else {
          console.log("Schemas");
          console.log("Name | Owner");
          console.log("-----|------");
          result.rows.forEach(row => {
            console.log(`${row.schema_name} | ${row.schema_owner}`);
          });
          console.log(`(${result.rows.length} ${result.rows.length === 1 ? "schema" : "schemas"})`);
        }
        return true;
      } catch (err: any) {
        console.error("Error listing schemas:", err.message || err);
        return true;
      }
    }

    // Describe table
    if (command.startsWith("\\d ") || command.startsWith("/describe ") || command.startsWith("/desc ")) {
      // Extract table name based on command format
      let tableName = "";
      if (command.startsWith("\\d ")) {
        tableName = command.substring(3).trim();
      } else if (command.startsWith("/describe ")) {
        tableName = command.substring(10).trim();
      } else if (command.startsWith("/desc ")) {
        tableName = command.substring(6).trim();
      }

      try {
        const query = `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM 
            information_schema.columns
          WHERE 
            table_name = $1
          ORDER BY 
            ordinal_position;
        `;
        const result = await pool.query(query, [tableName]);
        
        if (result.rows.length === 0) {
          console.log(`Table "${tableName}" does not exist.`);
        } else {
          console.log(`Table "${tableName}"`);
          console.log("Column | Type | Nullable | Default");
          console.log("-------|------|----------|--------");
          result.rows.forEach(row => {
            console.log(`${row.column_name} | ${row.data_type} | ${row.is_nullable} | ${row.column_default || ''}`);
          });
          console.log(`(${result.rows.length} ${result.rows.length === 1 ? "column" : "columns"})`);
        }
        return true;
      } catch (err: any) {
        console.error(`Error describing table "${tableName}":`, err.message || err);
        return true;
      }
    }

    // List databases
    if (command === "\\l" || command === "/list databases" || command === "/databases") {
      try {
        const query = `
          SELECT 
            datname as name,
            datdba as owner,
            pg_size_pretty(pg_database_size(datname)) as size
          FROM 
            pg_database
          WHERE 
            datistemplate = false
          ORDER BY 
            datname;
        `;
        const result = await pool.query(query);
        
        console.log("Databases");
        console.log("Name | Owner | Size");
        console.log("-----|-------|-----");
        result.rows.forEach(row => {
          console.log(`${row.name} | ${row.owner} | ${row.size}`);
        });
        console.log(`(${result.rows.length} ${result.rows.length === 1 ? "database" : "databases"})`);
        return true;
      } catch (err: any) {
        console.error("Error listing databases:", err.message || err);
        return true;
      }
    }

    // Help command
    if (command === "/help" || command === "\\h" || command === "\\help") {
      console.log("Available commands:");
      console.log("  /exit, /quit     - Exit the REPL");
      console.log("  /help            - Show this help message");
      console.log("  /clear           - Clear the current query buffer");
      console.log("  /tables          - List all tables");
      console.log("  /describe TABLE  - Show table structure");
      console.log("  /desc TABLE      - Short for /describe");
      console.log("  /schemas         - List all schemas");
      console.log("  /databases       - List all databases");
      console.log("");
      console.log("PostgreSQL-style commands (also supported):");
      console.log("  \\q, \\quit        - Exit the REPL");
      console.log("  \\h, \\help        - Show this help message");
      console.log("  \\c               - Clear the current query buffer");
      console.log("  \\dt              - List tables");
      console.log("  \\d TABLE         - Describe table");
      console.log("  \\dn              - List schemas");
      console.log("  \\l               - List databases");
      console.log("");
      console.log("Enter SQL queries and terminate with semicolon (;)");
      console.log("Example: SELECT * FROM users;");
      return true;
    }

    // Handle "show tables" as an alias for /tables
    if (command.toLowerCase() === "show tables;") {
      return executeMetaCommand("/tables");
    }

    return false;
  }

  rl.on("line", async (line) => {
    const trimmedLine = line.trim();
    
    // Handle exit commands
    if (trimmedLine === "\\q" || trimmedLine === "\\quit" || 
        trimmedLine === "/exit" || trimmedLine === "/quit") {
      console.log("Closing connection...");
      await pool.end();
      rl.close();
      return;
    }
    
    // Handle clear buffer command
    if (trimmedLine === "\\c" || trimmedLine === "/clear") {
      if (buffer.length > 0) {
        buffer = "";
        console.log("Query buffer cleared");
      }
      rl.prompt();
      return;
    }

    // Check for meta-commands that don't need a semicolon
    if (trimmedLine.startsWith("\\") || trimmedLine.startsWith("/")) {
      const handled = await executeMetaCommand(trimmedLine);
      if (handled) {
        rl.prompt();
        return;
      }
    }

    // Add the line to the buffer
    buffer += line + " ";

    // Check if the query is complete (ends with semicolon)
    if (buffer.trim().endsWith(";")) {
      const query = buffer.trim();
      buffer = "";

      // Check for special SQL commands that we want to handle differently
      if (query.toLowerCase() === "show tables;") {
        await executeMetaCommand("/tables");
        rl.prompt();
        return;
      }

      try {
        console.log("Executing query...");
        const startTime = Date.now();
        const result = await pool.query(query);
        const duration = Date.now() - startTime;

        // Display results
        if (result.command === "SELECT") {
          // Format and display the rows
          if (result.rows.length > 0) {
            console.table(result.rows);
          } else {
            console.log("(0 rows)");
          }
          console.log(`(${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}, ${duration}ms)`);
        } else {
          // For non-SELECT queries, show affected row count
          console.log(`${result.command} completed: ${result.rowCount} ${result.rowCount === 1 ? "row" : "rows"} affected (${duration}ms)`);
        }
      } catch (err: any) {
        console.error("Error executing query:", err.message || err);
      }
    } else {
      // If the query is not complete, show a continuation prompt
      process.stdout.write("... ");
      return;
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    console.log("Goodbye!");
    await pool.end();
    process.exit(0);
  });
}