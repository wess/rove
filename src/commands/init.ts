import fs from "node:fs";
import path from "node:path";

export default function init() {
  const migrationsDir = path.resolve("migrations");

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir);
    console.log("✔ Created migrations/");
  } else {
    console.log("✔ migrations/ already exists");
  }

  console.log("\n⚠️  Be sure to set your DATABASE_URL before running migrations:");
  console.log('   export DATABASE_URL="postgres://user:pass@localhost:5432/db"\n');
}
