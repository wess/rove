import fs from "fs";
import path from "path";
import { sql } from "bun";

export default async function down() {
  // 1) Fetch the last applied migration
  const [last] = await sql`
    SELECT name
    FROM migrations
    ORDER BY run_on DESC
    LIMIT 1
  `;
  if (!last) {
    console.log("No migrations to revert.");
    return;
  }
  const name: string = last.name;

  // 2) Locate and run down.sql
  const downPath = path.resolve("migrations", name, "down.sql");
  if (!fs.existsSync(downPath)) {
    console.warn(`⚠ Skipping "${name}": no down.sql found`);
  } else {
    const script = fs.readFileSync(downPath, "utf-8").trim();
    console.log(`→ Reverting ${name}`);
    await sql.unsafe(script);
    console.log(`✔ Reverted ${name}`);
  }

  // 3) Remove the record from the migrations table
  await sql`
    DELETE FROM migrations
    WHERE name = ${name}
  `;
}