import fs from "fs";
import path from "path";
import { sql } from "bun";

/**
 * Load a SQL schema file into the current database.
 * @param inputFile - Optional. The filename to load (defaults to "schema.sql").
 */
export default async function load(inputFile: string = "schema.sql") {
  const filePath = path.resolve(inputFile);
  if (!fs.existsSync(filePath)) {
    console.error(`⚠️  File not found: ${filePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(filePath, "utf-8").trim();
  if (!sqlContent) {
    console.error(`⚠️  ${inputFile} is empty`);
    process.exit(1);
  }

  console.log(`→ Loading schema from ${inputFile}…`);
  try {
    // Execute all statements in the file
    await sql.unsafe(sqlContent);
    console.log("✔ Schema loaded successfully");
  } catch (err: any) {
    console.error("❌ Error loading schema:", err.message || err);
    process.exit(1);
  }
}