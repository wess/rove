import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

export default async function up(): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️  Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Spin up a throw-away pool for this migration run
  const upPool = new Pool({ connectionString: envUrl });
  const client = await upPool.connect();

  try {
    // 3) Start a transaction
    await client.query("BEGIN");

    // 4) Ensure the migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_on TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 5) Load already-applied migrations
    const { rows: appliedRows } = await client.query<{ name: string }>(
      "SELECT name FROM migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.name));

    // 6) Discover all migration folders
    const migrationsDir = path.resolve(process.cwd(), "migrations");
    let allMigs: string[];
    try {
      const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
      allMigs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      console.error(`⚠️  Migrations directory not found at ${migrationsDir}`);
      process.exit(1);
    }

    // 7) Apply each pending migration
    for (const name of allMigs) {
      if (applied.has(name)) {
        continue;
      }

      const upPath = path.join(migrationsDir, name, "up.sql");
      let script: string;
      try {
        script = (await fs.readFile(upPath, "utf-8")).trim();
      } catch {
        console.warn(`⚠️  Skipping "${name}": no up.sql found`);
        continue;
      }

      console.log(`→ Applying "${name}"…`);
      await client.query(script);
      await client.query("INSERT INTO migrations (name) VALUES ($1)", [name]);
      console.log(`✔ "${name}" applied.`);
    }

    // 8) Commit all changes
    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Error applying migrations:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await upPool.end();
  }
}
