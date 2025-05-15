import fs from "fs";
import path from "path";

export default function create(name: string) {
  const migrationsDir = path.resolve("migrations");

  // 1) Ensure top-level migrations folder exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir);
    console.log("✔ Created migrations/");
  }

  // 2) Build timestamped migration directory name
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const dirName = `${timestamp}_${name}`;
  const migrationPath = path.join(migrationsDir, dirName);

  // 3) Create the migration directory
  fs.mkdirSync(migrationPath);
  
  // 4) Scaffold up.sql and down.sql
  fs.writeFileSync(
    path.join(migrationPath, "up.sql"),
    "-- Write your UP migration SQL here\n"
  );
  fs.writeFileSync(
    path.join(migrationPath, "down.sql"),
    "-- Write your DOWN migration SQL here\n"
  );

  console.log(`✔ Created migration ${dirName}`);
}