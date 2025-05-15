import { sql } from "bun";

export default async function dropDb() {
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

  // 3) Switch to the default 'postgres' database for dropping
  const originalUrl = envUrl;
  parsed.pathname = "/postgres";
  process.env.DATABASE_URL = parsed.toString();

  // 4) Attempt to DROP DATABASE
  try {
    console.log(`→ Dropping database "${dbName}"…`);
    // Identifiers can’t be parameterized, so use unsafe
    await sql.unsafe(`DROP DATABASE "${dbName}"`);
    console.log(`✔ Database "${dbName}" dropped.`);
  } catch (err: any) {
    // Postgres error code 3D000 = invalid_catalog_name (database does not exist)
    if (err.code === "3D000" || /does not exist/.test(err.message)) {
      console.log(`✔ Database "${dbName}" does not exist.`);
    } else {
      console.error("❌ Error dropping database:", err.message || err);
      process.exit(1);
    }
  } finally {
    // 5) Restore original DATABASE_URL
    process.env.DATABASE_URL = originalUrl;
  }
}