import { Pool } from "pg";

const getEnvUrl = (): string => {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    console.error("⚠️ Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }
  return url;
};

const listTables = async (pool: Pool): Promise<void> => {
  const result = await pool.query(`
    SELECT
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  if (result.rows.length === 0) {
    console.log("No tables found.");
    return;
  }

  console.log("Tables in public schema:\n");
  for (const row of result.rows) {
    console.log(`  ${row.table_name}`);
  }
  console.log(`\n(${result.rows.length} ${result.rows.length === 1 ? "table" : "tables"})`);
};

const describeTable = async (pool: Pool, tableName: string): Promise<void> => {
  const result = await pool.query(
    `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = $1
      AND table_schema = 'public'
    ORDER BY ordinal_position;
  `,
    [tableName],
  );

  if (result.rows.length === 0) {
    console.error(`Table "${tableName}" not found.`);
    process.exit(1);
  }

  console.log(`\nTable: ${tableName}\n`);
  console.log("Column | Type | Nullable | Default");
  console.log("-------|------|----------|--------");

  for (const row of result.rows) {
    const type = row.character_maximum_length
      ? `${row.data_type}(${row.character_maximum_length})`
      : row.data_type;
    const nullable = row.is_nullable === "YES" ? "YES" : "NO";
    const defaultVal = row.column_default || "";
    console.log(`${row.column_name} | ${type} | ${nullable} | ${defaultVal}`);
  }

  console.log(`\n(${result.rows.length} ${result.rows.length === 1 ? "column" : "columns"})`);
};

export default async function table(nameOrList?: string): Promise<void> {
  const envUrl = getEnvUrl();
  const pool = new Pool({ connectionString: envUrl });

  try {
    if (!nameOrList || nameOrList === "list") {
      await listTables(pool);
    } else {
      await describeTable(pool, nameOrList);
    }
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
