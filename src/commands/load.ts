import { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";

/**
 * Load a SQL schema file into the current database.
 * @param inputFile - Optional. The filename to load (defaults to "schema.sql").
 */
export default async function load(inputFile: string = "schema.sql"): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️ Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Resolve and read the SQL file
  const filePath = path.resolve(process.cwd(), inputFile);
  try {
    await fs.access(filePath);
  } catch {
    console.error(`⚠️ File not found: ${filePath}`);
    process.exit(1);
  }

  let sqlContent: string;
  try {
    sqlContent = (await fs.readFile(filePath, "utf-8")).trim();
  } catch (err: any) {
    console.error(`❌ Error reading file "${inputFile}":`, err.message || err);
    process.exit(1);
  }

  if (!sqlContent) {
    console.error(`⚠️ ${inputFile} is empty`);
    process.exit(1);
  }

  // 3) Spin up a throw-away pool and client
  const loadPool = new Pool({ connectionString: envUrl });
  const client = await loadPool.connect();

  try {
    console.log(`→ Loading schema from "${inputFile}"…`);
    await client.query("BEGIN");

    // 4) Split on semicolons and run each statement
    const statements = sqlContent.split(";").map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await client.query(stmt);
    }

    await client.query("COMMIT");
    console.log("✔ Schema loaded successfully");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Error loading schema:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await loadPool.end();
  }
}