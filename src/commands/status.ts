// src/commands/status.ts

import fs from "fs";
import path from "path";
import { sql } from "bun";

interface StatusOptions {
  exitCode?: boolean;
  quiet?: boolean;
}

/**
 * Show the status of all migrations.
 * @param opts.exitCode  Exit with code=1 if there are pending migrations.
 * @param opts.quiet     Only print summary.
 */
export default async function status(opts: StatusOptions = {}) {
  const migrationsDir = path.resolve("migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("No migrations directory found. Run `shift init` first.");
    process.exit(1);
  }

  // Fetch applied migrations
  const appliedRows = await sql`SELECT name, run_on FROM migrations`;
  const appliedMap = new Map<string, Date>(
    appliedRows.map((row: { name: string; run_on: Date }) => [
      row.name,
      row.run_on,
    ])
  );

  // Discover all migration folders
  const allMigs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const pending = allMigs.filter((name) => !appliedMap.has(name));
  const applied = allMigs.filter((name) => appliedMap.has(name));

  if (opts.quiet) {
    console.log(
      `Applied: ${applied.length}, Pending: ${pending.length}`
    );
  } else {
    console.log("Migration status:");
    for (const name of allMigs) {
      if (appliedMap.has(name)) {
        console.log(
          `  [X] ${name} — applied at ${appliedMap
            .get(name)!
            .toISOString()}`
        );
      } else {
        console.log(`  [ ] ${name}`);
      }
    }
  }

  if (opts.exitCode && pending.length > 0) {
    process.exit(1);
  }
}