"use strict";

require("./config/env");
const { app } = require("./app");
const { pool } = require("./db/pool");

async function start() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.",
    );
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  await pool.query("SELECT 1");
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Smart Attendance API listening on http://0.0.0.0:${port}`);
  });
  const shutdown = () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(async (error) => {
  console.error(`Unable to start API: ${error.message}`);
  await pool.end();
  process.exitCode = 1;
});
