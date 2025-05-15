# Shift

**A nice little migration too for Postgresql.*

Shift provides a fast CLI for managing your Postgres schema:

* Organize migrations in timestamped folders with `up.sql` / `down.sql`
* Built on Bun’s native `sql` client—no external `pg` or `pg_dump` required
* Create / drop databases, run migrations, rollbacks, status checks, schema dumps & loads
* Cross‑platform support with native builds for Linux, macOS (Intel & ARM), and Windows

---

## 📦 Installation

```bash
# Install globally via Bun
bun install -g .
```

Or as a local dev dependency:

```bash
bun add -D shift
```

---

## 🚀 Getting Started

1. **Initialize** your migrations directory:

   ```bash
   shift init
   ```

2. **Generate** a new migration:

   ```bash
   shift new add_users_table
   # creates migrations/<timestamp>_add_users_table/{up.sql,down.sql}
   ```

3. **Write** your `up.sql` / `down.sql` files in the new folder.

4. **Run** pending migrations:

   ```bash
   shift up
   ```

5. **Rollback** the last migration:

   ```bash
   shift down
   ```

6. **Check** migration status:

   ```bash
   shift status
   ```

---

## ⚙️ CLI Commands

| Command             | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `shift help`        | Show usage information                                                    |
| `shift init`        | Create the top‑level `migrations/` folder                                 |
| `shift new <name>`  | Scaffold a new migration directory with `up.sql` and `down.sql`           |
| `shift create`      | Create the database specified by `DATABASE_URL`                           |
| `shift drop`        | Drop the database specified by `DATABASE_URL`                             |
| `shift up`          | Create DB if needed and run pending `up.sql` scripts                      |
| `shift migrate`     | Alias for `shift up`                                                      |
| `shift rollback`    | Revert the most recent `down.sql` script                                  |
| `shift down`        | Alias for `shift rollback`                                                |
| `shift status`      | Show applied vs pending migrations (supports `--exit-code` and `--quiet`) |
| `shift dump [file]` | Dump the public schema to a SQL file (default: `schema.sql`)              |
| `shift load [file]` | Load a SQL schema file into the database (default: `schema.sql`)          |

---

## 📂 Migrations Structure

```
project-root/
├─ migrations/
│  ├─ 20250515\_add_users_table/
│  │  ├─ up.sql   # applies changes
│  │  └─ down.sql # reverts changes
│  └─ 20250601\_add_orders_table/
│     ├─ up.sql
│     └─ down.sql

````

---

## 🛠️ Configuration

- **DATABASE_URL** (or **POSTGRES_URL**) environment variable must point to your Postgres instance:
  ```bash
  export DATABASE_URL="postgres://user:pass@host:5432/db"
````

* For schema dumps in Docker-only setups, set `PG_DOCKER_CONTAINER` to your container name.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Open a PR — tests & docs welcome!

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
