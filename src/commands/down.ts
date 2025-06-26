import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

export default async function down(): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️ Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Spin up a throw-away pool for this migration run
  const migrationPool = new Pool({ connectionString: envUrl });
  const client = await migrationPool.connect();

  try {
    // 3) Fetch the last applied migration
    const { rows } = await client.query<{ name: string }>(
      `SELECT name
         FROM migrations
        ORDER BY run_on DESC
         LIMIT 1`,
    );
    if (rows.length === 0) {
      console.log("✔ No migrations to revert.");
      return;
    }
    const lastName = rows[0].name;

    // 4) Locate down.sql
    const downPath = path.join(process.cwd(), "migrations", lastName, "down.sql");
    let script: string | null = null;
    try {
      script = (await fs.readFile(downPath, "utf-8")).trim();
    } catch {
      console.warn(`⚠️ Skipping "${lastName}": no down.sql found`);
    }

    // 5) Run revert + cleanup inside a transaction
    await client.query("BEGIN");

    if (script) {
      console.log(`→ Reverting "${lastName}"…`);
      await client.query(script);
      console.log(`✔ Reverted "${lastName}".`);
    }

    await client.query("DELETE FROM migrations WHERE name = $1", [lastName]);
    console.log(`✔ Removed record for "${lastName}".`);

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Error reverting migration:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await migrationPool.end();
  }
}
