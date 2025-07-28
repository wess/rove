import { Pool } from "pg";

interface SeedOptions {
  count?: number;
  truncate?: boolean;
  verbose?: boolean;
}

// Sample data generators
const generateRandomString = (length: number): string => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateRandomEmail = (): string => {
  const domains = ["example.com", "test.com", "demo.org", "sample.net"];
  const username = generateRandomString(8).toLowerCase();
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
};

const generateRandomName = (): string => {
  const firstNames = [
    "John",
    "Jane",
    "Alice",
    "Bob",
    "Charlie",
    "Diana",
    "Eve",
    "Frank",
    "Grace",
    "Henry",
    "Sarah",
    "Michael",
    "Emma",
    "David",
    "Lisa",
    "James",
    "Maria",
    "Robert",
    "Jennifer",
    "William",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Anderson",
    "Taylor",
    "Thomas",
    "Hernandez",
    "Moore",
    "Martin",
    "Jackson",
    "Thompson",
    "White",
    "Lopez",
  ];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
};

const generateCompanyName = (): string => {
  const prefixes = [
    "Tech",
    "Digital",
    "Global",
    "Smart",
    "Innovative",
    "Advanced",
    "Modern",
    "Future",
    "Dynamic",
    "Creative",
  ];
  const suffixes = [
    "Solutions",
    "Systems",
    "Corp",
    "Inc",
    "LLC",
    "Group",
    "Labs",
    "Works",
    "Studio",
    "Ventures",
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${prefix} ${suffix}`;
};

const generatePhoneNumber = (): string => {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const number = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${exchange}-${number}`;
};

const generateAddress = (): string => {
  const streetNumbers = Math.floor(Math.random() * 9999) + 1;
  const streetNames = [
    "Main St",
    "Oak Ave",
    "First St",
    "Second St",
    "Park Ave",
    "Elm St",
    "Washington St",
    "Maple Ave",
    "Cedar St",
    "Pine St",
  ];
  const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
  return `${streetNumbers} ${streetName}`;
};

const generateRandomText = (minWords: number = 5, maxWords: number = 20): string => {
  const words = [
    "lorem",
    "ipsum",
    "dolor",
    "sit",
    "amet",
    "consectetur",
    "adipiscing",
    "elit",
    "sed",
    "do",
    "eiusmod",
    "tempor",
    "incididunt",
    "ut",
    "labore",
    "et",
    "dolore",
    "magna",
    "aliqua",
    "enim",
    "ad",
    "minim",
    "veniam",
    "quis",
    "nostrud",
    "exercitation",
    "ullamco",
    "laboris",
    "nisi",
    "aliquip",
    "ex",
    "ea",
    "commodo",
    "consequat",
    "duis",
    "aute",
    "irure",
    "in",
    "reprehenderit",
  ];

  const wordCount = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
  const selectedWords = [];

  for (let i = 0; i < wordCount; i++) {
    selectedWords.push(words[Math.floor(Math.random() * words.length)]);
  }

  return selectedWords.join(" ");
};

const generateValueForColumn = (column: any, existingIds: Map<string, any[]> = new Map()): any => {
  const { column_name, data_type, character_maximum_length, is_nullable } = column;

  // Handle nullable columns (20% chance of null)
  if (is_nullable === "YES" && Math.random() < 0.2) {
    return null;
  }

  // Handle foreign key columns (columns ending with _id)
  if (column_name.toLowerCase().endsWith("_id") && column_name.toLowerCase() !== "id") {
    const referencedTable = `${column_name.toLowerCase().replace("_id", "")}s`;
    const ids = existingIds.get(referencedTable) || [];
    if (ids.length > 0) {
      return ids[Math.floor(Math.random() * ids.length)];
    }
    // Fallback based on data type
    if (data_type.toLowerCase() === "uuid") {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    return Math.floor(Math.random() * 10) + 1;
  }

  // Generate based on data type first (primary logic)
  switch (data_type.toLowerCase()) {
    case "integer":
    case "bigint":
    case "smallint":
      return Math.floor(Math.random() * 1000) + 1;

    case "numeric":
    case "decimal":
    case "real":
    case "double precision":
      return Math.round((Math.random() * 1000 + 1) * 100) / 100;

    case "boolean":
      return Math.random() < 0.5;

    case "date": {
      const startDate = new Date("2020-01-01");
      const endDate = new Date();
      const randomTime =
        startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
      return new Date(randomTime).toISOString().split("T")[0];
    }

    case "timestamp":
    case "timestamp with time zone":
    case "timestamp without time zone": {
      const startTimestamp = new Date("2020-01-01");
      const endTimestamp = new Date();
      const randomTimestamp =
        startTimestamp.getTime() +
        Math.random() * (endTimestamp.getTime() - startTimestamp.getTime());
      return new Date(randomTimestamp).toISOString();
    }

    case "time":
    case "time with time zone":
    case "time without time zone": {
      const hours = Math.floor(Math.random() * 24)
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor(Math.random() * 60)
        .toString()
        .padStart(2, "0");
      const seconds = Math.floor(Math.random() * 60)
        .toString()
        .padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    }

    case "uuid":
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

    case "json":
    case "jsonb":
      return JSON.stringify({
        id: Math.floor(Math.random() * 1000),
        name: generateRandomString(10),
        active: Math.random() < 0.5,
      });

    case "array":
    case "text[]":
    case "character varying[]":
    case "varchar[]":
    case "integer[]": {
      const arraySize = Math.floor(Math.random() * 3) + 1;
      const arrayItems = [];
      for (let i = 0; i < arraySize; i++) {
        if (data_type.includes("integer")) {
          arrayItems.push(Math.floor(Math.random() * 100));
        } else {
          arrayItems.push(generateRandomString(8));
        }
      }
      return arrayItems;
    }

    case "text":
    case "character varying":
    case "varchar":
    case "character":
    case "char": {
      // For text fields, use column name hints to generate more realistic data
      const colName = column_name.toLowerCase();
      const maxLength = character_maximum_length || 255;

      // Only use column name patterns for text fields where it makes sense
      if (colName.includes("email")) {
        return generateRandomEmail();
      }
      if (colName.includes("phone") || colName.includes("mobile") || colName.includes("tel")) {
        return generatePhoneNumber();
      }
      if (colName.includes("address") || colName.includes("street")) {
        return generateAddress();
      }
      if (
        colName.includes("company") ||
        colName.includes("organization") ||
        colName.includes("org")
      ) {
        return generateCompanyName();
      }
      if (colName.includes("first_name") || colName.includes("firstname")) {
        const firstNames = [
          "John",
          "Jane",
          "Alice",
          "Bob",
          "Charlie",
          "Diana",
          "Eve",
          "Frank",
          "Grace",
          "Henry",
        ];
        return firstNames[Math.floor(Math.random() * firstNames.length)];
      }
      if (
        colName.includes("last_name") ||
        colName.includes("lastname") ||
        colName.includes("surname")
      ) {
        const lastNames = [
          "Smith",
          "Johnson",
          "Williams",
          "Brown",
          "Jones",
          "Garcia",
          "Miller",
          "Davis",
        ];
        return lastNames[Math.floor(Math.random() * lastNames.length)];
      }
      if (
        colName.includes("name") ||
        colName.includes("display_name") ||
        colName.includes("full_name")
      ) {
        return generateRandomName();
      }
      if (colName.includes("title") || colName.includes("heading")) {
        return generateRandomText(2, 6);
      }
      if (
        colName.includes("description") ||
        colName.includes("content") ||
        colName.includes("body")
      ) {
        return generateRandomText(10, Math.min(50, Math.floor(maxLength / 10)));
      }
      if (colName.includes("url") || colName.includes("link") || colName.includes("website")) {
        return `https://example.com/${generateRandomString(10).toLowerCase()}`;
      }
      if (colName.includes("slug") || colName.includes("permalink")) {
        return generateRandomString(15)
          .toLowerCase()
          .replace(/[^a-z]/g, "-");
      }
      if (colName.includes("status")) {
        const statuses = ["active", "inactive", "pending", "draft", "published", "archived"];
        return statuses[Math.floor(Math.random() * statuses.length)];
      }
      if (colName.includes("type") || colName.includes("category")) {
        const types = ["standard", "premium", "basic", "advanced", "pro", "free"];
        return types[Math.floor(Math.random() * types.length)];
      }
      if (colName.includes("color") || colName.includes("colour")) {
        const colors = [
          "red",
          "blue",
          "green",
          "yellow",
          "purple",
          "orange",
          "pink",
          "black",
          "white",
          "gray",
        ];
        return colors[Math.floor(Math.random() * colors.length)];
      }

      // Default text generation
      const length = Math.min(Math.floor(Math.random() * 20) + 5, maxLength);
      return generateRandomString(length);
    }

    default: {
      // Fallback for unknown types
      const fallbackMaxLength = character_maximum_length || 50;
      const fallbackLength = Math.min(Math.floor(Math.random() * 20) + 5, fallbackMaxLength);
      return generateRandomString(fallbackLength);
    }
  }
};

export default async function seed(options: SeedOptions = {}): Promise<void> {
  const { count = 10, truncate = false, verbose = false } = options;

  // 1) Grab DATABASE_URL (or POSTGRES_URL) from env
  const envUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!envUrl) {
    console.error("⚠️  Missing DATABASE_URL or POSTGRES_URL environment variable");
    process.exit(1);
  }

  // 2) Parse the URL to get database name for display
  let parsed: URL;
  try {
    parsed = new URL(envUrl);
  } catch {
    console.error("⚠️  Invalid DATABASE_URL format");
    process.exit(1);
  }

  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) {
    console.error("⚠️  Could not determine database name from URL");
    process.exit(1);
  }

  // 3) Create a connection pool
  const pool = new Pool({ connectionString: envUrl });

  try {
    // Test connection
    const client = await pool.connect();
    console.log(`✔ Connected to database "${dbName}"`);
    client.release();

    console.log(`🌱 Starting database seeding with ${count} records per table...`);

    // 4) Get all user tables (excluding system tables and migrations)
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name != 'migrations'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log("ℹ️  No tables found to seed");
      return;
    }

    console.log(`📋 Found ${tablesResult.rows.length} table(s) to seed:`);
    for (const table of tablesResult.rows) {
      console.log(`   • ${table.table_name}`);
    }
    console.log();

    // 5) Collect existing IDs for foreign key relationships
    const existingIds = new Map<string, any[]>();

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      try {
        const idResult = await pool.query(
          `SELECT id FROM "${tableName}" WHERE id IS NOT NULL LIMIT 100`,
        );
        if (idResult.rows.length > 0) {
          existingIds.set(
            tableName,
            idResult.rows.map((row) => row.id),
          );
        }
      } catch {
        // Table might not have an 'id' column, skip
      }
    }

    // 6) Process each table
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      try {
        console.log(`🔄 Processing table: ${tableName}`);

        // Get table structure
        const columnsResult = await pool.query(
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

        const columns = columnsResult.rows;

        // Filter out auto-increment/serial columns and columns with defaults
        const insertableColumns = columns.filter((col) => {
          const hasDefault = col.column_default !== null;
          const isSerial = col.column_default?.includes("nextval");
          return !isSerial && (!hasDefault || col.is_nullable === "YES");
        });

        if (verbose) {
          console.log(
            `   📊 Table structure: ${columns.length} total columns, ${insertableColumns.length} insertable`,
          );
          console.log(
            `   📝 Insertable columns: ${insertableColumns.map((c) => c.column_name).join(", ")}`,
          );
        }

        if (insertableColumns.length === 0) {
          console.log(`   ⚠️  No insertable columns found for ${tableName}, skipping`);
          continue;
        }

        // Truncate table if requested
        if (truncate) {
          await pool.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
          console.log(`   🗑️  Truncated table ${tableName}`);
        }

        // Check if table already has data (if not truncating)
        if (!truncate) {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const existingCount = parseInt(countResult.rows[0].count);
          if (existingCount > 0) {
            console.log(
              `   ℹ️  Table ${tableName} already has ${existingCount} records, skipping (use --truncate to override)`,
            );
            continue;
          }
        }

        // Check if table has an id column
        const hasIdColumn = columns.some((col) => col.column_name === "id");

        // Generate and insert data
        const columnNames = insertableColumns.map((col) => `"${col.column_name}"`).join(", ");
        const placeholders = insertableColumns.map((_, index) => `$${index + 1}`).join(", ");
        const insertQuery = hasIdColumn
          ? `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders}) RETURNING id`
          : `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

        let insertedCount = 0;
        const newIds: any[] = [];

        for (let i = 0; i < count; i++) {
          const values = insertableColumns.map((col) => generateValueForColumn(col, existingIds));

          try {
            const result = await pool.query(insertQuery, values);
            insertedCount++;

            // Collect new IDs if the table has an id column
            if (hasIdColumn && result.rows.length > 0 && result.rows[0].id) {
              newIds.push(result.rows[0].id);
            }
          } catch (err: any) {
            // Skip this record if there's a constraint violation
            if (err.code === "23505" || err.code === "23503") {
              // Unique constraint or foreign key constraint violation
              continue;
            }
            throw err;
          }
        }

        // Update existing IDs map with new IDs
        if (newIds.length > 0) {
          const currentIds = existingIds.get(tableName) || [];
          existingIds.set(tableName, [...currentIds, ...newIds]);
        }

        console.log(`   ✅ Inserted ${insertedCount} records into ${tableName}`);
      } catch (err: any) {
        console.error(`   ❌ Error seeding table ${tableName}:`, err.message || err);
        // Continue with other tables
      }
    }

    console.log();
    console.log("🎉 Database seeding completed!");
  } catch (err: any) {
    console.error("❌ Error during seeding:", err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
