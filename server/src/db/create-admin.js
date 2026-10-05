"use strict";

require("../config/env");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { pool } = require("./pool");

async function createAdmin() {
  const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .parse(process.env.ADMIN_BOOTSTRAP_EMAIL)
    .toLowerCase();
  const password = z
    .string()
    .min(12)
    .max(128)
    .parse(process.env.ADMIN_BOOTSTRAP_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(826597120061::bigint)");
    const existing = await client.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE role = 'ADMIN' AND is_active = TRUE",
    );
    if (existing.rows[0].count > 0)
      throw new Error(
        "An active administrator already exists; bootstrap is first-admin-only.",
      );
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'ADMIN')",
      [email, hash],
    );
    await client.query("COMMIT");
    console.log(`Created first administrator account: ${email}`);
    console.log(
      "Remove ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from the environment after use.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  createAdmin()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error("Could not create administrator:", error.message);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = { createAdmin };
