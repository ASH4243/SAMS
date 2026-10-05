"use strict";

const express = require("express");
const { pool } = require("../db/pool");
const { z, className, semester, page, limit } = require("../lib/validation");
const { AppError, asyncHandler, positiveId } = require("../lib/errors");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const subjectSchema = z.object({
  subjectCode: z.string().trim().min(1).max(32),
  subjectName: z.string().trim().min(2).max(160),
  className,
  semester,
  teacherId: z
    .union([z.coerce.number().int().positive(), z.null()])
    .optional()
    .nullable(),
});
const subjectUpdate = subjectSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(120).optional().default(""),
        className: z.string().trim().max(100).optional(),
        semester: z.coerce.number().int().min(1).max(12).optional(),
        page,
        limit,
      })
      .parse(req.query);
    const params = [];
    const where = ["su.is_active = TRUE"];
    const add = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (query.q) {
      const token = add(`%${query.q}%`);
      where.push(
        `(su.subject_name ILIKE ${token} OR su.subject_code ILIKE ${token})`,
      );
    }
    if (query.className) where.push(`su.class_name = ${add(query.className)}`);
    if (query.semester) where.push(`su.semester = ${add(query.semester)}`);
    if (req.user.role === "TEACHER")
      where.push(
        `su.teacher_id = (SELECT id FROM teachers WHERE user_id = ${add(req.user.id)} AND is_active = TRUE)`,
      );
    if (req.user.role === "STUDENT") {
      where.push(
        `EXISTS (SELECT 1 FROM students st WHERE st.user_id = ${add(req.user.id)} AND st.is_active = TRUE AND st.class_name = su.class_name AND st.semester = su.semester)`,
      );
    }
    const whereSql = where.join(" AND ");
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM subjects su WHERE ${whereSql}`,
      params,
    );
    const limitToken = add(query.limit);
    const offsetToken = add((query.page - 1) * query.limit);
    const rows = await pool.query(
      `SELECT su.id, su.subject_code AS "subjectCode", su.subject_name AS "subjectName", su.class_name AS "className",
       su.semester, su.teacher_id AS "teacherId", t.full_name AS "teacherName", su.created_at AS "createdAt"
     FROM subjects su LEFT JOIN teachers t ON t.id = su.teacher_id WHERE ${whereSql}
     ORDER BY su.class_name, su.semester, su.subject_name LIMIT ${limitToken} OFFSET ${offsetToken}`,
      params,
    );
    res.json({
      success: true,
      data: {
        subjects: rows.rows,
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
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = subjectSchema.parse(req.body);
    if (body.teacherId) {
      const teacher = await pool.query(
        "SELECT 1 FROM teachers WHERE id = $1 AND is_active = TRUE",
        [body.teacherId],
      );
      if (!teacher.rowCount)
        throw new AppError(400, "Select an active teacher.");
    }
    const result = await pool.query(
      `INSERT INTO subjects (subject_code, subject_name, class_name, semester, teacher_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        body.subjectCode,
        body.subjectName,
        body.className,
        body.semester,
        body.teacherId || null,
      ],
    );
    res.status(201).json({ success: true, data: { id: result.rows[0].id } });
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const body = subjectUpdate.parse(req.body);
    if (body.teacherId) {
      const teacher = await pool.query(
        "SELECT 1 FROM teachers WHERE id = $1 AND is_active = TRUE",
        [body.teacherId],
      );
      if (!teacher.rowCount)
        throw new AppError(400, "Select an active teacher.");
    }
    const map = {
      subjectCode: "subject_code",
      subjectName: "subject_name",
      className: "class_name",
      semester: "semester",
      teacherId: "teacher_id",
    };
    const values = [];
    const fields = Object.entries(body).map(([key, value]) => {
      values.push(key === "teacherId" ? value || null : value);
      return `${map[key]} = $${values.length}`;
    });
    values.push(id);
    const result = await pool.query(
      `UPDATE subjects SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} AND is_active = TRUE RETURNING id`,
      values,
    );
    if (!result.rowCount) throw new AppError(404, "Subject not found.");
    res.json({ success: true, data: { message: "Subject updated." } });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      "UPDATE subjects SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE RETURNING id",
      [positiveId(req.params.id)],
    );
    if (!result.rowCount) throw new AppError(404, "Subject not found.");
    res.json({ success: true, data: { message: "Subject deactivated." } });
  }),
);

module.exports = router;
