"use strict";

const jwt = require("jsonwebtoken");
const { pool } = require("../db/pool");
const { AppError } = require("../lib/errors");

const COOKIE_NAME = "attendance_session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

function issueSession(res, user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new AppError(500, "Authentication is not configured.");
  }
  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: 8 * 60 * 60 * 1000,
  });
}

async function requireAuth(req, _res, next) {
  try {
    const bearer = req.get("authorization");
    const token =
      (req.cookies && req.cookies[COOKIE_NAME]) ||
      (bearer && bearer.startsWith("Bearer ") ? bearer.slice(7) : null);
    if (!token) throw new AppError(401, "Please sign in to continue.");
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
      throw new AppError(500, "Authentication is not configured.");
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError(
        401,
        "Your session has expired. Please sign in again.",
      );
    }
    const result = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1 AND is_active = TRUE",
      [payload.sub],
    );
    if (!result.rowCount)
      throw new AppError(
        401,
        "Your account is unavailable. Please sign in again.",
      );
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user)
      return next(new AppError(401, "Please sign in to continue."));
    if (!roles.includes(req.user.role))
      return next(
        new AppError(403, "You do not have permission to perform this action."),
      );
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  cookieOptions,
  issueSession,
  requireAuth,
  requireRole,
};
