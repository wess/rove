import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import init from "../src/commands/init";
import newCmd from "../src/commands/new";

describe("Integration Tests", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(tmpdir(), "rove-integration-"));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Migration Workflow", () => {
    it("should complete a full migration workflow", () => {
      // 1. Initialize migrations directory
      init();
      
      const migrationsDir = path.join(testDir, "migrations");
      expect(fs.existsSync(migrationsDir)).toBe(true);
      
      // 2. Create first migration
      newCmd("create_users_table");
      
      let entries = fs.readdirSync(migrationsDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain("create_users_table");
      
      const firstMigration = entries[0];
      const firstMigrationPath = path.join(migrationsDir, firstMigration);
      
      // Verify migration files exist
      expect(fs.existsSync(path.join(firstMigrationPath, "up.sql"))).toBe(true);
      expect(fs.existsSync(path.join(firstMigrationPath, "down.sql"))).toBe(true);
      
      // 3. Add SQL content to first migration
      fs.writeFileSync(
        path.join(firstMigrationPath, "up.sql"),
        `CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );`
      );
      
      fs.writeFileSync(
        path.join(firstMigrationPath, "down.sql"),
        "DROP TABLE users;"
      );
      
      // 4. Create second migration
      newCmd("add_user_profile");
      
      entries = fs.readdirSync(migrationsDir);
      expect(entries).toHaveLength(2);
      
      const secondMigration = entries.find(e => e.includes("add_user_profile"))!;
      const secondMigrationPath = path.join(migrationsDir, secondMigration);
      
      // 5. Add SQL content to second migration
      fs.writeFileSync(
        path.join(secondMigrationPath, "up.sql"),
        `CREATE TABLE user_profiles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          bio TEXT,
          avatar_url TEXT
        );`
      );
      
      fs.writeFileSync(
        path.join(secondMigrationPath, "down.sql"),
        "DROP TABLE user_profiles;"
      );
      
      // 6. Verify migration structure
      const createUsersEntry = entries.find(e => e.includes("create_users_table"));
      const addProfileEntry = entries.find(e => e.includes("add_user_profile"));
      
      expect(createUsersEntry).toBeDefined();
      expect(addProfileEntry).toBeDefined();
      
      // Verify all files exist
      for (const entry of entries) {
        const migrationPath = path.join(migrationsDir, entry);
        expect(fs.statSync(migrationPath).isDirectory()).toBe(true);
        expect(fs.existsSync(path.join(migrationPath, "up.sql"))).toBe(true);
        expect(fs.existsSync(path.join(migrationPath, "down.sql"))).toBe(true);
        
        // Verify files have content
        const upContent = fs.readFileSync(path.join(migrationPath, "up.sql"), "utf-8");
        const downContent = fs.readFileSync(path.join(migrationPath, "down.sql"), "utf-8");
        
        expect(upContent.trim().length).toBeGreaterThan(0);
        expect(downContent.trim().length).toBeGreaterThan(0);
        expect(upContent).not.toBe("-- Write your UP migration SQL here");
        expect(downContent).not.toBe("-- Write your DOWN migration SQL here");
      }
    });

    it("should handle multiple migrations with proper ordering", async () => {
      init();
      
      // Create migrations with small delays to ensure different timestamps
      newCmd("migration_001");
      await new Promise(resolve => setTimeout(resolve, 10));
      
      newCmd("migration_002");
      await new Promise(resolve => setTimeout(resolve, 10));
      
      newCmd("migration_003");
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir).sort();
      
      expect(entries).toHaveLength(3);
      expect(entries[0]).toContain("migration_001");
      expect(entries[1]).toContain("migration_002");
      expect(entries[2]).toContain("migration_003");
      
      // Verify chronological ordering
      expect(entries[0] < entries[1]).toBe(true);
      expect(entries[1] < entries[2]).toBe(true);
    });

    it("should handle migration names with various characters", () => {
      init();
      
      const migrationNames = [
        "create_users",
        "add-email-index",
        "update_user_schema",
        "remove.old.table",
        "migration_with_123_numbers"
      ];
      
      migrationNames.forEach(name => {
        newCmd(name);
      });
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir);
      
      expect(entries).toHaveLength(migrationNames.length);
      
      migrationNames.forEach(name => {
        const matchingEntry = entries.find(entry => entry.includes(name));
        expect(matchingEntry).toBeDefined();
      });
    });
  });

  describe("File System Operations", () => {
    it("should handle existing migrations directory gracefully", () => {
      // Create migrations directory manually
      const migrationsDir = path.join(testDir, "migrations");
      fs.mkdirSync(migrationsDir);
      
      // Create a dummy migration
      const existingMigration = path.join(migrationsDir, "existing_migration");
      fs.mkdirSync(existingMigration);
      fs.writeFileSync(path.join(existingMigration, "up.sql"), "SELECT 1;");
      
      // Run init - should not fail
      expect(() => init()).not.toThrow();
      
      // Run new command - should work alongside existing migration
      newCmd("new_migration");
      
      const entries = fs.readdirSync(migrationsDir);
      expect(entries).toHaveLength(2);
      expect(entries).toContain("existing_migration");
      expect(entries.some(e => e.includes("new_migration"))).toBe(true);
    });

    it("should create migrations with proper file permissions", () => {
      init();
      newCmd("test_permissions");
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir);
      const migrationPath = path.join(migrationsDir, entries[0]);
      
      const upFile = path.join(migrationPath, "up.sql");
      const downFile = path.join(migrationPath, "down.sql");
      
      // Check that files are readable and writable
      expect(() => fs.readFileSync(upFile, "utf-8")).not.toThrow();
      expect(() => fs.readFileSync(downFile, "utf-8")).not.toThrow();
      
      // Check that we can write to the files
      expect(() => fs.writeFileSync(upFile, "SELECT 1;")).not.toThrow();
      expect(() => fs.writeFileSync(downFile, "SELECT 2;")).not.toThrow();
      
      // Verify content was written
      expect(fs.readFileSync(upFile, "utf-8")).toBe("SELECT 1;");
      expect(fs.readFileSync(downFile, "utf-8")).toBe("SELECT 2;");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long migration names", () => {
      init();
      
      const longName = "a".repeat(200); // Very long migration name
      
      expect(() => newCmd(longName)).not.toThrow();
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir);
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain(longName);
    });

    it("should handle migration names with unicode characters", () => {
      init();
      
      const unicodeName = "migration_with_émojis_🚀_and_ñ";
      
      expect(() => newCmd(unicodeName)).not.toThrow();
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir);
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toContain(unicodeName);
    });

    it("should handle empty migration names gracefully", () => {
      init();
      
      // This should create a migration with just the timestamp
      newCmd("");
      
      const migrationsDir = path.join(testDir, "migrations");
      const entries = fs.readdirSync(migrationsDir);
      
      expect(entries).toHaveLength(1);
      // Should have timestamp format
      expect(entries[0]).toMatch(/^\d{17}_$/);
    });
  });
});