import fs from "fs";
import path from "path";
import { sql } from "bun";

export default async function up() {
  // 1) Ensure the migrations table exists
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_on TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 2) Load the set of already-applied migrations
  const appliedRows = await sql`SELECT name FROM migrations`;
  const applied = new Set<string>(appliedRows.map(r => r.name));

  // 3) Discover all migration folders
  const migrationsDir = path.resolve("migrations");
  const allMigs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  // 4) Apply each pending migration
  for (const name of allMigs) {
    if (applied.has(name)) continue;

    const upPath = path.join(migrationsDir, name, "up.sql");
    if (!fs.existsSync(upPath)) {
      console.warn(`⚠ skipping "${name}": no up.sql found`);
      continue;
    }

    const script = fs.readFileSync(upPath, "utf-8").trim();
    console.log(`→ Applying ${name}`);
    await sql.unsafe(script);
    await sql`INSERT INTO migrations (name) VALUES (${name})`;
    console.log(`✔ ${name}`);
  }
}