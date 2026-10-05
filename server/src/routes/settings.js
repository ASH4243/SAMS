"use strict";

const express = require("express");
const { pool } = require("../db/pool");
const { z } = require("../lib/validation");
const { asyncHandler } = require("../lib/errors");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'low_attendance_threshold'",
    );
    const threshold = Number(
      result.rows[0]?.setting_value ??
        process.env.LOW_ATTENDANCE_THRESHOLD ??
        75,
    );
    res.json({ success: true, data: { lowAttendanceThreshold: threshold } });
  }),
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ lowAttendanceThreshold: z.number().finite().min(0).max(100) })
      .parse(req.body);
    await pool.query(
      `INSERT INTO settings (setting_key, setting_value, updated_at) VALUES ('low_attendance_threshold', $1, NOW())
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
      [String(body.lowAttendanceThreshold)],
    );
    res.json({
      success: true,
      data: { lowAttendanceThreshold: body.lowAttendanceThreshold },
    });
  }),
);

module.exports = router;
