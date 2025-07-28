#!/usr/bin/env bun

import { Command } from "commander";

import downCmd from "./commands/down";
// Migration commands
import initCmd from "./commands/init";
import newCmd from "./commands/new";
import statusCmd from "./commands/status";
import upCmd from "./commands/up";

import connectCmd from "./commands/connect";
// Database management commands
import createDbCmd from "./commands/create";
import dropDbCmd from "./commands/drop";
import runCmd from "./commands/run";

// Schema dump/load
import dumpCmd from "./commands/dump";
import loadCmd from "./commands/load";

// MCP server
import mcpCmd from "./commands/mcp";

// Seed command
import seedCmd from "./commands/seed";

const cli = new Command().name("rove").description("PostgreSQL migrations tool").version("0.0.5");

// show help (alias for --help)
cli
  .command("help")
  .description("Print usage help")
  .action(() => cli.help());

// generate a new migration directory
cli.command("new <name>").description("Generate a new migration").action(newCmd);

// initialize migrations folder
cli.command("init").description("Initialize migrations folder").action(initCmd);

// create the database
cli.command("create").description("Create the database").action(createDbCmd);

// drop the database
cli.command("drop").description("Drop the database").action(dropDbCmd);

// apply pending migrations (creating DB if needed)
cli.command("up").description("Create DB if needed and run pending migrations").action(upCmd);

// alias for up
cli.command("migrate").description("Run any pending migrations").action(upCmd);

// revert the last migration
cli.command("rollback").description("Roll back the most recent migration").action(downCmd);

// alias for rollback
cli.command("down").description("Alias for rollback").action(downCmd);

// show migration status
cli
  .command("status")
  .description("Show status of all migrations")
  .option("--exit-code", "Exit with code=1 if there are pending migrations")
  .option("--quiet", "Only print summary")
  .action((opts) => statusCmd(opts));

// dump schema to file
cli
  .command("dump [file]")
  .description("Dump the public schema to a SQL file (default: schema.sql)")
  .action((file: string) => dumpCmd(file));

// load schema from file
cli
  .command("load [file]")
  .description("Load a SQL schema file into the database (default: schema.sql)")
  .action((file: string) => loadCmd(file));

// connect to database with SQL REPL
cli
  .command("connect")
  .description("Connect to the database with an interactive SQL REPL")
  .action(connectCmd);

// execute a SQL query and pretty print the results
cli
  .command("run [query]")
  .description("Execute a SQL query and pretty print the results")
  .option("--show-tables", "Show all tables in the database")
  .option("--query <sql>", "SQL query to execute")
  .action((query, options) => runCmd(query, options));

// start MCP server
cli
  .command("mcp")
  .description("Start Model Context Protocol server for database access")
  .option("--port <port>", "HTTP port to run on (default: stdio transport)", parseInt)
  .option("--host <host>", "Host to bind to (default: localhost)", "localhost")
  .action(mcpCmd);

// seed database with sample data
cli
  .command("seed")
  .description("Fill database tables with generated sample data")
  .option("--count <count>", "Number of records to generate per table (default: 10)", parseInt, 10)
  .option("--truncate", "Truncate tables before seeding (default: false)")
  .option("--verbose", "Show detailed information about data generation")
  .action(seedCmd);

cli.parse(process.argv);
