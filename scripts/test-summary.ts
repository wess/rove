#!/usr/bin/env bun

/**
 * Test Summary Script for Rove
 * 
 * This script provides a comprehensive overview of the test suite
 * and runs tests with better reporting.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TESTS_DIR = path.join(process.cwd(), "tests");

function getTestFiles(): string[] {
  const files: string[] = [];
  
  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith(".test.ts")) {
        files.push(path.relative(TESTS_DIR, fullPath));
      }
    }
  }
  
  scanDirectory(TESTS_DIR);
  return files.sort();
}

function countTestsInFile(filePath: string): number {
  const content = fs.readFileSync(path.join(TESTS_DIR, filePath), "utf-8");
  const matches = content.match(/it\(/g);
  return matches ? matches.length : 0;
}

function getTestCategory(filePath: string): string {
  if (filePath.startsWith("commands/")) {
    return "Unit Tests";
  } else if (filePath.includes("integration")) {
    return "Integration Tests";
  } else if (filePath.includes("main")) {
    return "CLI Tests";
  } else if (filePath.includes("mcp")) {
    return "MCP Tests";
  } else {
    return "Other Tests";
  }
}

function printTestSummary() {
  console.log("🧪 Rove Test Suite Summary");
  console.log("=" .repeat(50));
  console.log();
  
  const testFiles = getTestFiles();
  const categories = new Map<string, { files: string[], tests: number }>();
  let totalTests = 0;
  
  // Categorize tests
  for (const file of testFiles) {
    const category = getTestCategory(file);
    const testCount = countTestsInFile(file);
    totalTests += testCount;
    
    if (!categories.has(category)) {
      categories.set(category, { files: [], tests: 0 });
    }
    
    const cat = categories.get(category)!;
    cat.files.push(file);
    cat.tests += testCount;
  }
  
  // Print summary
  console.log(`📊 Test Statistics:`);
  console.log(`   Total Files: ${testFiles.length}`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log();
  
  // Print by category
  for (const [category, data] of categories.entries()) {
    console.log(`📁 ${category}:`);
    console.log(`   Files: ${data.files.length}`);
    console.log(`   Tests: ${data.tests}`);
    
    for (const file of data.files) {
      const testCount = countTestsInFile(file);
      console.log(`   • ${file} (${testCount} tests)`);
    }
    console.log();
  }
  
  console.log("🎯 Test Coverage Areas:");
  console.log("   ✅ Command Functions (init, new, up, down, status, create, drop, run, seed, connect, mcp)");
  console.log("   ✅ Error Handling (missing env vars, invalid URLs, database errors)");
  console.log("   ✅ File System Operations (creating directories, reading/writing files)");
  console.log("   ✅ Database Interactions (mocked with pg Pool)");
  console.log("   ✅ CLI Argument Parsing and Help Output");
  console.log("   ✅ MCP Server Functionality (tools, resources, HTTP/stdio modes)");
  console.log("   ✅ Integration Workflows (complete migration cycles)");
  console.log("   ✅ Edge Cases (unicode names, long names, special characters)");
  console.log();
}

function runTests() {
  console.log("🚀 Running Rove Test Suite...");
  console.log("=" .repeat(50));
  console.log();
  
  try {
    const result = execSync("bun test", { 
      encoding: "utf-8",
      stdio: "inherit"
    });
    
    console.log();
    console.log("✅ Test run completed!");
    
  } catch (error) {
    console.log();
    console.log("❌ Some tests failed. See output above for details.");
    process.exit(1);
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes("--summary-only")) {
    printTestSummary();
  } else if (args.includes("--run-only")) {
    runTests();
  } else {
    printTestSummary();
    console.log();
    runTests();
  }
}

main();