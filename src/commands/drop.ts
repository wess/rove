import { Pool } from "pg";

export default async function dropDb(): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️  Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Parse out the database name
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

  // 3) Prepare a temporary pool against the default "postgres" database
  const dropUrl = new URL(envUrl);
  dropUrl.pathname = "/postgres";
  const dropPool = new Pool({ connectionString: dropUrl.toString() });

  // 4) Attempt to DROP DATABASE
  try {
    console.log(`→ Dropping database "${dbName}"…`);
    await dropPool.query(`DROP DATABASE "${dbName}"`);
    console.log(`✔ Database "${dbName}" dropped.`);
  } catch (err: any) {
    // 3D000 = invalid_catalog_name (database does not exist)
    if (err.code === "3D000" || /does not exist/i.test(err.message)) {
      console.log(`✔ Database "${dbName}" does not exist.`);
    } else {
      console.error("❌ Error dropping database:", err.message || err);
      process.exit(1);
    }
  } finally {
    // 5) Clean up the temporary pool
    await dropPool.end();
  }
}