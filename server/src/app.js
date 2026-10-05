"use strict";

require("./config/env");
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { pool } = require("./db/pool");
const { projectRoot } = require("./config/env");
const { errorHandler, AppError } = require("./lib/errors");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const studentRoutes = require("./routes/students");
const teacherRoutes = require("./routes/teachers");
const subjectRoutes = require("./routes/subjects");
const attendanceRoutes = require("./routes/attendance");
const settingsRoutes = require("./routes/settings");

const app = express();
const allowedOrigins = new Set(
  [process.env.CLIENT_URL, ...(process.env.CORS_ORIGINS || "").split(",")]
    .filter(Boolean)
    .map((origin) => origin.trim()),
);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        process.env.NODE_ENV !== "production"
      )
        return callback(null, true);
      return callback(new AppError(403, "This browser origin is not allowed."));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") app.use(morgan("tiny"));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, data: { status: "ok" } });
  } catch (error) {
    next(error);
  }
});
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/settings", settingsRoutes);

app.use("/api", (_req, _res, next) =>
  next(new AppError(404, "API endpoint not found.")),
);
const clientDist = path.join(projectRoot, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    }),
  );
  app.get("*", (_req, res, next) =>
    res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) next(error);
    }),
  );
}
app.use(errorHandler);

module.exports = { app };
