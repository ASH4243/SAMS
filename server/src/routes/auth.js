"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { pool } = require("../db/pool");
const { z, email } = require("../lib/validation");
const { AppError, asyncHandler } = require("../lib/errors");
const {
  COOKIE_NAME,
  cookieOptions,
  issueSession,
  requireAuth,
} = require("../middleware/auth");

const router = express.Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Please try again in 15 minutes.",
  },
});

async function accountFor(user) {
  if (user.role === "STUDENT") {
    const result = await pool.query(
      `SELECT id, student_id AS "studentId", unique_id AS "uniqueId", roll_number AS "rollNumber",
         enrollment_number AS "enrollmentNumber", full_name AS "fullName", parents_name AS "parentsName",
         blood_group AS "bloodGroup", class_name AS "className", semester, profile_photo AS "profilePhoto"
       FROM students WHERE user_id = $1 AND is_active = TRUE`,
      [user.id],
    );
    return result.rows[0] || null;
  }
  if (user.role === "TEACHER") {
    const result = await pool.query(
      'SELECT id, employee_id AS "employeeId", full_name AS "fullName" FROM teachers WHERE user_id = $1 AND is_active = TRUE',
      [user.id],
    );
    return result.rows[0] || null;
  }
  return null;
}

router.post(
  "/login",
  loginLimit,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ email, password: z.string().min(1).max(128) })
      .parse(req.body);
    const result = await pool.query(
      "SELECT id, email, password_hash, role FROM users WHERE email = $1 AND is_active = TRUE",
      [body.email],
    );
    const user = result.rows[0];
    const matches = user
      ? await bcrypt.compare(body.password, user.password_hash)
      : false;
    if (!matches) throw new AppError(401, "Email or password is incorrect.");
    if (user.role === "STUDENT") {
      const activeProfile = await pool.query(
        "SELECT 1 FROM students WHERE user_id = $1 AND is_active = TRUE",
        [user.id],
      );
      if (!activeProfile.rowCount)
        throw new AppError(401, "This account is not available.");
    }
    if (user.role === "TEACHER") {
      const activeProfile = await pool.query(
        "SELECT 1 FROM teachers WHERE user_id = $1 AND is_active = TRUE",
        [user.id],
      );
      if (!activeProfile.rowCount)
        throw new AppError(401, "This account is not available.");
    }
    issueSession(res, user);
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: await accountFor(user),
        },
      },
    });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true, data: { message: "Signed out." } });
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: { user: { ...req.user, profile: await accountFor(req.user) } },
    });
  }),
);

module.exports = router;
