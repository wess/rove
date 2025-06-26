import { Pool } from "pg";

export default async function createDb(): Promise<void> {
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

  // 3) Build a temporary pool against the default "postgres" database
  const creationUrl = new URL(envUrl);
  creationUrl.pathname = "/postgres";
  const creationPool = new Pool({ connectionString: creationUrl.toString() });

  // 4) Attempt to CREATE DATABASE
  try {
    console.log(`→ Creating database "${dbName}"…`);
    // Identifiers can’t be parameterized, so interpolate carefully
    await creationPool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✔ Database "${dbName}" created.`);
  } catch (err: any) {
    // 42P04 = duplicate_database
    if (err.code === "42P04" || /already exists/i.test(err.message)) {
      console.log(`✔ Database "${dbName}" already exists.`);
    } else {
      console.error("❌ Error creating database:", err.message || err);
      process.exit(1);
    }
  } finally {
    // 5) Clean up the temporary pool
    await creationPool.end();
  }
}
