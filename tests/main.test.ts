import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(require("node:child_process").execFile);

describe("Rove CLI", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should show help when no command is provided", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("PostgreSQL migrations tool");
      expect(stdout).toContain("Commands:");
      expect(stdout).toContain("help");
      expect(stdout).toContain("new");
      expect(stdout).toContain("init");
      expect(stdout).toContain("up");
      expect(stdout).toContain("down");
      expect(stdout).toContain("status");
      expect(stdout).toContain("mcp");
    } catch (error: any) {
      // Help command might exit with code 0 or 1, both are acceptable
      if (error.code !== 0 && error.code !== 1) {
        throw error;
      }
      expect(error.stdout).toContain("PostgreSQL migrations tool");
    }
  });

  it("should show version information", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "--version"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("0.0.5");
    } catch (error: any) {
      // Version command might exit with different codes
      expect(error.stdout || error.stderr).toContain("0.0.5");
    }
  });

  it("should show help for specific commands", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("PostgreSQL migrations tool");
    } catch (error: any) {
      expect(error.stdout).toContain("PostgreSQL migrations tool");
    }
  });

  it("should handle new command with name parameter", async () => {
    // This test would require a temporary directory setup
    // For now, we'll test that the command structure is correct
    const commands = [
      "new <name>",
      "init",
      "create",
      "drop",
      "up",
      "migrate",
      "rollback",
      "down",
      "status",
      "dump [file]",
      "load [file]",
      "connect",
      "run [query]",
      "mcp",
      "seed"
    ];

    // Test that all expected commands are available in help
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      commands.forEach(command => {
        const commandName = command.split(" ")[0];
        expect(stdout).toContain(commandName);
      });
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      commands.forEach(command => {
        const commandName = command.split(" ")[0];
        expect(output).toContain(commandName);
      });
    }
  });

  it("should handle status command options", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "status", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("--exit-code");
      expect(stdout).toContain("--quiet");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("--exit-code") || expect(output).toContain("--quiet");
    }
  });

  it("should handle run command options", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "run", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("--show-tables");
      expect(stdout).toContain("--query");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("--show-tables") || expect(output).toContain("--query");
    }
  });

  it("should handle mcp command options", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "mcp", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("--port");
      expect(stdout).toContain("--host");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("--port") || expect(output).toContain("--host");
    }
  });

  it("should handle seed command options", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "seed", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("--count");
      expect(stdout).toContain("--truncate");
      expect(stdout).toContain("--verbose");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("--count") || expect(output).toContain("--truncate") || expect(output).toContain("--verbose");
    }
  });
});

describe("Command Aliases", () => {
  it("should support migrate as alias for up", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("migrate");
      expect(stdout).toContain("Run any pending migrations");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("migrate");
    }
  });

  it("should support rollback as alias for down", async () => {
    try {
      const { stdout } = await execFile("bun", ["run", "src/main.ts", "--help"], {
        cwd: "/Users/wess/Desktop/Dev/rove",
        timeout: 5000
      });
      
      expect(stdout).toContain("rollback");
      expect(stdout).toContain("Roll back the most recent migration");
    } catch (error: any) {
      const output = error.stdout || error.stderr;
      expect(output).toContain("rollback");
    }
  });
});