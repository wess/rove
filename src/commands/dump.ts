import fs from "fs";
import path from "path";
import { sql } from "bun";

/**
 * Dump the public schema to a SQL file, no external CLI needed.
 * @param outputFile filename to write to (defaults to "schema.sql")
 */
export default async function dump(outputFile: string = "schema.sql") {
  // 1) Fetch all public tables
  const tables = (
    await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  ).map((r: any) => r.table_name);

  let ddl = "";

  // 2) Build CREATE TABLE for each
  for (const tbl of tables) {
    // pull columns
    const cols = await sql`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tbl}
      ORDER BY ordinal_position;
    `;

    const colDefs = cols
      .map((c: any) => {
        let line = `  "${c.column_name}" ${c.data_type}`;
        if (c.character_maximum_length) {
          line += `(${c.character_maximum_length})`;
        }
        if (c.column_default) {
          line += ` DEFAULT ${c.column_default}`;
        }
        if (c.is_nullable === "NO") {
          line += " NOT NULL";
        }
        return line;
      })
      .join(",\n");

    ddl += `--\n-- Table: ${tbl}\n--\n\n`;
    ddl += `CREATE TABLE "${tbl}" (\n${colDefs}\n);\n\n`;
  }

  // 3) Append all indexes
  const idxs = (
    await sql`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `
  ).map((r: any) => r.indexdef + ";");

  if (idxs.length) {
    ddl += "--\n-- Indexes\n--\n\n";
    ddl += idxs.join("\n") + "\n\n";
  }

  // 4) (Optional) You could also introspect sequences, views, functions...
  // e.g. await sql`SELECT pg_get_viewdef(viewname,true) ...`

  // 5) Write it out
  const outPath = path.resolve(outputFile);
  fs.writeFileSync(outPath, ddl);
  console.log(`✔ Wrote schema to ${outPath}`);
}