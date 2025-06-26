import { Pool } from "pg";

export default async function runQuery(query: string): Promise<void> {
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

  try {
    // Test connection
    const client = await pool.connect();
    console.log(`✔ Connected to database "${dbName}"`);
    client.release();

    // Ensure query ends with semicolon
    const formattedQuery = query.trim().endsWith(';') ? query : `${query};`;
    
    // Execute the query
    console.log(`Executing: ${formattedQuery}`);
    const startTime = Date.now();
    const result = await pool.query(formattedQuery);
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
    console.error("❌ Error executing query:", err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}