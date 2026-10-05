"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const fs = require("node:fs/promises");
const { pool } = require("../db/pool");
const {
  z,
  email,
  password,
  name,
  className,
  semester,
  bloodGroup,
  page: pageSchema,
  limit: limitSchema,
} = require("../lib/validation");
const { AppError, asyncHandler, positiveId } = require("../lib/errors");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  imageUpload,
  savePhoto,
  removePhoto,
  resolvePhoto,
} = require("../lib/upload");

const router = express.Router();
const studentFields = `s.id, s.user_id AS "userId", u.email, s.student_id AS "studentId", s.unique_id AS "uniqueId",
  s.roll_number AS "rollNumber", s.enrollment_number AS "enrollmentNumber", s.full_name AS "fullName",
  s.parents_name AS "parentsName", s.blood_group AS "bloodGroup", s.class_name AS "className", s.semester,
  s.profile_photo AS "profilePhoto", s.created_at AS "createdAt", s.updated_at AS "updatedAt"`;
const createSchema = z.object({
  email,
  password,
  studentId: z.string().trim().min(1).max(64),
  uniqueId: z.string().trim().min(1).max(64),
  rollNumber: z.string().trim().min(1).max(64),
  enrollmentNumber: z.string().trim().min(1).max(80),
  fullName: name,
  parentsName: z.string().trim().max(160).optional().nullable(),
  bloodGroup,
  className,
  semester,
});
const updateSchema = createSchema
  .omit({ password: true })
  .partial()
  .refine(
    (body) => Object.keys(body).length > 0,
    "Provide at least one field to update.",
  );

async function accessibleStudent(rawId, user) {
  const studentId = positiveId(rawId);
  const result = await pool.query(
    `SELECT ${studentFields}, s.is_active AS "isActive"
     FROM students s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.is_active = TRUE AND (
       $2 = 'ADMIN' OR ($2 = 'STUDENT' AND s.user_id = $3) OR
       ($2 = 'TEACHER' AND EXISTS (
         SELECT 1 FROM subjects su JOIN teachers t ON t.id = su.teacher_id
         WHERE t.user_id = $3 AND su.is_active = TRUE AND su.class_name = s.class_name AND su.semester = s.semester
       ))
     )`,
    [studentId, user.role, user.id],
  );
  if (!result.rowCount) throw new AppError(404, "Student not found.");
  return result.rows[0];
}

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().max(120).optional().default(""),
        className: z.string().trim().max(100).optional(),
        semester: z.coerce.number().int().min(1).max(12).optional(),
        page: pageSchema,
        limit: limitSchema,
      })
      .parse(req.query);
    const params = [];
    const add = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where = ["s.is_active = TRUE"];
    if (query.q) {
      const matcher = add(`%${query.q}%`);
      where.push(
        `(s.full_name ILIKE ${matcher} OR s.roll_number ILIKE ${matcher} OR s.student_id ILIKE ${matcher} OR s.enrollment_number ILIKE ${matcher})`,
      );
    }
    if (query.className) where.push(`s.class_name = ${add(query.className)}`);
    if (query.semester) where.push(`s.semester = ${add(query.semester)}`);
    if (req.user.role === "TEACHER") {
      const userId = add(req.user.id);
      where.push(`EXISTS (SELECT 1 FROM subjects scope_su JOIN teachers scope_t ON scope_t.id = scope_su.teacher_id
      WHERE scope_t.user_id = ${userId} AND scope_su.is_active = TRUE AND scope_su.class_name = s.class_name AND scope_su.semester = s.semester)`);
    }
    const whereSql = where.join(" AND ");
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM students s WHERE ${whereSql}`,
      params,
    );
    const limitToken = add(query.limit);
    const offsetToken = add((query.page - 1) * query.limit);
    const data = await pool.query(
      `SELECT ${studentFields}, COUNT(a.id)::int AS "attendanceTotal",
       COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS "attendancePresent"
     FROM students s JOIN users u ON u.id = s.user_id
     LEFT JOIN attendance a ON a.student_id = s.id
     WHERE ${whereSql} GROUP BY s.id, u.id ORDER BY s.full_name ASC
     LIMIT ${limitToken} OFFSET ${offsetToken}`,
      params,
    );
    const setting = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'low_attendance_threshold'",
    );
    const lowAttendanceThreshold = Number(
      setting.rows[0]?.setting_value ??
        process.env.LOW_ATTENDANCE_THRESHOLD ??
        75,
    );
    res.json({
      success: true,
      data: {
        lowAttendanceThreshold,
        students: data.rows.map((student) => ({
          ...student,
          attendancePercentage: student.attendanceTotal
            ? Math.round(
                (student.attendancePresent * 1000) / student.attendanceTotal,
              ) / 10
            : 0,
        })),
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
    const body = createSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'STUDENT') RETURNING id, email`,
        [body.email, await bcrypt.hash(body.password, 12)],
      );
      const student = await client.query(
        `INSERT INTO students (user_id, student_id, unique_id, roll_number, enrollment_number, full_name,
        parents_name, blood_group, class_name, semester)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          user.rows[0].id,
          body.studentId,
          body.uniqueId,
          body.rollNumber,
          body.enrollmentNumber,
          body.fullName,
          body.parentsName || null,
          body.bloodGroup || null,
          body.className,
          body.semester,
        ],
      );
      await client.query("COMMIT");
      res.status(201).json({
        success: true,
        data: { id: student.rows[0].id, email: user.rows[0].email },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.get(
  "/:id/photo",
  requireAuth,
  requireRole("ADMIN", "TEACHER", "STUDENT"),
  asyncHandler(async (req, res, next) => {
    const student = await accessibleStudent(req.params.id, req.user);
    const filePath = resolvePhoto(student.profilePhoto);
    if (!filePath)
      throw new AppError(404, "No profile photo has been uploaded.");
    try {
      await fs.access(filePath);
    } catch {
      throw new AppError(404, "Profile photo not found.");
    }
    const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";
    res.set("Cache-Control", "private, no-store");
    res.type(contentType);
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  }),
);

router.post(
  "/:id/photo",
  requireAuth,
  requireRole("ADMIN", "TEACHER", "STUDENT"),
  imageUpload,
  asyncHandler(async (req, res) => {
    const student = await accessibleStudent(req.params.id, req.user);
    if (!req.file) throw new AppError(400, "Choose a profile photo to upload.");
    const saved = await savePhoto(req.file);
    try {
      await pool.query(
        "UPDATE students SET profile_photo = $1, updated_at = NOW() WHERE id = $2",
        [saved.filename, student.id],
      );
    } catch (error) {
      await removePhoto(saved.filename);
      throw error;
    }
    await removePhoto(student.profilePhoto);
    res.json({ success: true, data: { message: "Profile photo updated." } });
  }),
);

router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "TEACHER", "STUDENT"),
  asyncHandler(async (req, res) => {
    const student = await accessibleStudent(req.params.id, req.user);
    res.json({ success: true, data: { student } });
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const body = updateSchema.parse(req.body);
    const keys = Object.keys(body);
    const columns = {
      email: "u.email",
      studentId: "s.student_id",
      uniqueId: "s.unique_id",
      rollNumber: "s.roll_number",
      enrollmentNumber: "s.enrollment_number",
      fullName: "s.full_name",
      parentsName: "s.parents_name",
      bloodGroup: "s.blood_group",
      className: "s.class_name",
      semester: "s.semester",
    };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT user_id FROM students WHERE id = $1 AND is_active = TRUE FOR UPDATE",
        [id],
      );
      if (!current.rowCount) throw new AppError(404, "Student not found.");
      let userEmail;
      if (body.email) {
        const changed = await client.query(
          "UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING email",
          [body.email, current.rows[0].user_id],
        );
        userEmail = changed.rows[0].email;
      }
      const values = [];
      const assignments = [];
      for (const key of keys) {
        if (key === "email") continue;
        values.push(body[key] === "" ? null : body[key]);
        assignments.push(`${columns[key].slice(2)} = $${values.length}`);
      }
      if (assignments.length) {
        values.push(id);
        await client.query(
          `UPDATE students SET ${assignments.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
          values,
        );
      } else if (userEmail) {
        await client.query(
          "UPDATE students SET updated_at = NOW() WHERE id = $1",
          [id],
        );
      }
      await client.query("COMMIT");
      res.json({ success: true, data: { message: "Student updated." } });
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
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const client = await pool.connect();
    let photo;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE students SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE RETURNING user_id, profile_photo`,
        [id],
      );
      if (!result.rowCount) throw new AppError(404, "Student not found.");
      photo = result.rows[0].profile_photo;
      await client.query(
        "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        [result.rows[0].user_id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await removePhoto(photo);
    res.json({ success: true, data: { message: "Student deactivated." } });
  }),
);

module.exports = router;
