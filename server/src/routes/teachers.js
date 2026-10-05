"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db/pool");
const { z, email, password, name, page, limit } = require("../lib/validation");
const { AppError, asyncHandler, positiveId } = require("../lib/errors");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));
const createSchema = z.object({
  email,
  password,
  employeeId: z.string().trim().min(1).max(64),
  fullName: name,
});
const updateSchema = z
  .object({
    email: email.optional(),
    employeeId: z.string().trim().min(1).max(64).optional(),
    fullName: name.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(120).optional().default(""),
        page,
        limit,
      })
      .parse(req.query);
    const params = [];
    let where = "t.is_active = TRUE";
    if (query.q) {
      params.push(`%${query.q}%`);
      where += ` AND (t.full_name ILIKE $1 OR t.employee_id ILIKE $1 OR u.email ILIKE $1)`;
    }
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM teachers t JOIN users u ON u.id = t.user_id WHERE ${where}`,
      params,
    );
    const offset = (query.page - 1) * query.limit;
    const data = await pool.query(
      `SELECT t.id, t.employee_id AS "employeeId", t.full_name AS "fullName", u.email,
       COUNT(DISTINCT su.id)::int AS "subjectCount", t.created_at AS "createdAt"
     FROM teachers t JOIN users u ON u.id = t.user_id LEFT JOIN subjects su ON su.teacher_id = t.id AND su.is_active = TRUE
     WHERE ${where} GROUP BY t.id, u.id ORDER BY t.full_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, query.limit, offset],
    );
    res.json({
      success: true,
      data: {
        teachers: data.rows,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: count.rows[0].total,
          totalPages: Math.ceil(count.rows[0].total / query.limit),
        },
      },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'TEACHER') RETURNING id`,
        [body.email, await bcrypt.hash(body.password, 12)],
      );
      const teacher = await client.query(
        "INSERT INTO teachers (user_id, employee_id, full_name) VALUES ($1, $2, $3) RETURNING id",
        [user.rows[0].id, body.employeeId, body.fullName],
      );
      await client.query("COMMIT");
      res.status(201).json({ success: true, data: { id: teacher.rows[0].id } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const body = updateSchema.parse(req.body);
    const current = await pool.query(
      "SELECT user_id FROM teachers WHERE id = $1 AND is_active = TRUE",
      [id],
    );
    if (!current.rowCount) throw new AppError(404, "Teacher not found.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const teacherFields = [];
      const values = [];
      for (const [key, column] of [
        ["employeeId", "employee_id"],
        ["fullName", "full_name"],
      ]) {
        if (body[key] !== undefined) {
          values.push(body[key]);
          teacherFields.push(`${column} = $${values.length}`);
        }
      }
      if (teacherFields.length) {
        values.push(id);
        await client.query(
          `UPDATE teachers SET ${teacherFields.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
          values,
        );
      }
      if (body.email)
        await client.query(
          "UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2",
          [body.email, current.rows[0].user_id],
        );
      await client.query("COMMIT");
      res.json({ success: true, data: { message: "Teacher updated." } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE teachers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE RETURNING user_id",
        [id],
      );
      if (!result.rowCount) throw new AppError(404, "Teacher not found.");
      await client.query(
        "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        [result.rows[0].user_id],
      );
      await client.query(
        "UPDATE subjects SET teacher_id = NULL, updated_at = NOW() WHERE teacher_id = $1",
        [id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({
      success: true,
      data: { message: "Teacher deactivated and subjects unassigned." },
    });
  }),
);

module.exports = router;
