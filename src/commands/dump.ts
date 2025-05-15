import { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";

/**
 * Dump the public schema to a SQL file, no external CLI needed.
 * @param outputFile filename to write to (defaults to "schema.sql")
 */
export default async function dump(outputFile: string = "schema.sql"): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️ Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Spin up a throw-away pool for the dump
  const dumpPool = new Pool({ connectionString: envUrl });
  const client = await dumpPool.connect();

  try {
    // 3) Fetch all public tables
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;`
    );
    const tables = tableRows.map(r => r.table_name);

    let ddl = "";

    // 4) Build CREATE TABLE for each
    for (const tbl of tables) {
      const { rows: colRows } = await client.query<{
        column_name: string,
        data_type: string,
        character_maximum_length: number | null,
        is_nullable: "YES" | "NO",
        column_default: string | null
      }>(
        `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
          ORDER BY ordinal_position;`,
        [tbl]
      );

      const colDefs = colRows
        .map(c => {
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

    // 5) Append all indexes
    const { rows: idxRows } = await client.query<{ indexdef: string }>(
      `SELECT indexdef
         FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;`
    );
    const idxs = idxRows.map(r => r.indexdef + ";");

    if (idxs.length) {
      ddl += `--\n-- Indexes\n--\n\n`;
      ddl += idxs.join("\n") + "\n\n";
    }

    // 6) Write out the DDL
    const outPath = path.resolve(process.cwd(), outputFile);
    await fs.writeFile(outPath, ddl);
    console.log(`✔ Wrote schema to ${outPath}`);
  } catch (err: any) {
    console.error("❌ Error dumping schema:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await dumpPool.end();
  }
}