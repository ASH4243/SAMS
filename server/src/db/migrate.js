"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
require("../config/env");
const { pool } = require("./pool");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const directory = path.join(__dirname, "migrations");
    const files = (await fs.readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [file],
      );
      if (alreadyApplied.rowCount) continue;
      const sql = await fs.readFile(path.join(directory, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      console.log(`Applied migration ${file}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(async () => {
      console.log("Database migrations are up to date.");
      await pool.end();
    })
    .catch(async (error) => {
      console.error("Database migration failed:", error.message);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = { migrate };
