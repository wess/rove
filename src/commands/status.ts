import { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";

interface StatusOptions {
  exitCode?: boolean;
  quiet?: boolean;
}

/**
 * Show the status of all migrations.
 * @param opts.exitCode  Exit with code=1 if there are pending migrations.
 * @param opts.quiet     Only print summary.
 */
export default async function status(opts: StatusOptions = {}): Promise<void> {
  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️ Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Ensure migrations directory exists
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  try {
    const stat = await fs.stat(migrationsDir);
    if (!stat.isDirectory()) throw new Error();
  } catch {
    console.log("No migrations directory found. Run `shift init` first.");
    process.exit(1);
  }

  // 3) Spin up a throw-away pool for status checks
  const statusPool = new Pool({ connectionString: envUrl });
  const client = await statusPool.connect();

  try {
    // 4) Fetch applied migrations
    const { rows: appliedRows } = await client.query<{
      name: string;
      run_on: Date;
    }>(
      `SELECT name, run_on
         FROM migrations
     ORDER BY run_on ASC`
    );
    const appliedMap = new Map<string, Date>(
      appliedRows.map(r => [r.name, r.run_on])
    );

    // 5) Discover all migration folders
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    const allMigs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));

    const pending = allMigs.filter(name => !appliedMap.has(name));
    const applied = allMigs.filter(name => appliedMap.has(name));

    // 6) Print status
    if (opts.quiet) {
      console.log(`Applied: ${applied.length}, Pending: ${pending.length}`);
    } else {
      console.log("Migration status:");
      for (const name of allMigs) {
        if (appliedMap.has(name)) {
          console.log(
            `  [X] ${name} — applied at ${appliedMap.get(name)!.toISOString()}`
          );
        } else {
          console.log(`  [ ] ${name}`);
        }
      }
    }

    // 7) Exit with code=1 if requested and there are pending migrations
    if (opts.exitCode && pending.length > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("❌ Error checking migration status:", err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await statusPool.end();
  }
}