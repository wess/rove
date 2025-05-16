<p align="center">
  <img src="assets/rove.png" alt="logo" width="128" height="128" />
</p>

# Rove

**A nice little migration tool for Postgresql.*

Rove provides a fast CLI for managing your Postgres schema:

* Organize migrations in timestamped folders with `up.sql` / `down.sql`
* Built on Bun’s native `sql` client—no external `pg` or `pg_dump` required
* Create / drop databases, run migrations, rollbacks, status checks, schema dumps & loads
* Cross‑platform support with native builds for Linux, macOS (Intel & ARM), and Windows

---

## 📦 Installation

```bash
# Using Homebrew
brew install wess/packages/rove
```

```bash
# Install globally via Bun
bun install -g .
```

Or as a local dev dependency:

```bash
bun add -D rove
```

---

## 🚀 Getting Started

1. **Initialize** your migrations directory:

   ```bash
   rove init
   ```

2. **Generate** a new migration:

   ```bash
   rove new add_users_table
   # creates migrations/<timestamp>_add_users_table/{up.sql,down.sql}
   ```

3. **Write** your `up.sql` / `down.sql` files in the new folder.

4. **Run** pending migrations:

   ```bash
   rove up
   ```

5. **Rollback** the last migration:

   ```bash
   rove down
   ```

6. **Check** migration status:

   ```bash
   rove status
   ```

---

## ⚙️ CLI Commands

| Command             | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `rove help`        | Show usage information                                                    |
| `rove init`        | Create the top‑level `migrations/` folder                                 |
| `rove new <name>`  | Scaffold a new migration directory with `up.sql` and `down.sql`           |
| `rove create`      | Create the database specified by `DATABASE_URL`                           |
| `rove drop`        | Drop the database specified by `DATABASE_URL`                             |
| `rove up`          | Create DB if needed and run pending `up.sql` scripts                      |
| `rove migrate`     | Alias for `rove up`                                                      |
| `rove rollback`    | Revert the most recent `down.sql` script                                  |
| `rove down`        | Alias for `rove rollback`                                                |
| `rove status`      | Show applied vs pending migrations (supports `--exit-code` and `--quiet`) |
| `rove dump [file]` | Dump the public schema to a SQL file (default: `schema.sql`)              |
| `rove load [file]` | Load a SQL schema file into the database (default: `schema.sql`)          |

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
