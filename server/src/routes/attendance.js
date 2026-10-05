"use strict";

const express = require("express");
const { pool } = require("../db/pool");
const { z, dateOnly, page, limit } = require("../lib/validation");
const { attendancePercentage } = require("../lib/attendance");
const { AppError, asyncHandler, positiveId } = require("../lib/errors");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const statusSchema = z.enum(["PRESENT", "ABSENT"]);
const historyQuery = z
  .object({
    studentId: z.coerce.number().int().positive().optional(),
    subjectId: z.coerce.number().int().positive().optional(),
    className: z.string().trim().max(100).optional(),
    semester: z.coerce.number().int().min(1).max(12).optional(),
    date: dateOnly.optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    status: statusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    page,
    limit,
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "The start date must not be after the end date.",
    path: ["from"],
  });

async function authorizedSubject(subjectId, user) {
  const result = await pool.query(
    `SELECT su.id, su.class_name AS "className", su.semester, su.teacher_id AS "teacherId"
     FROM subjects su WHERE su.id = $1 AND su.is_active = TRUE AND (
       $2 = 'ADMIN' OR ($2 = 'TEACHER' AND su.teacher_id = (SELECT id FROM teachers WHERE user_id = $3 AND is_active = TRUE))
     )`,
    [subjectId, user.role, user.id],
  );
  if (!result.rowCount)
    throw new AppError(404, "Subject not found or not assigned to you.");
  return result.rows[0];
}

async function authorizedStudent(studentId, user) {
  const result = await pool.query(
    `SELECT s.id, s.user_id AS "userId", s.class_name AS "className", s.semester
     FROM students s WHERE s.id = $1 AND s.is_active = TRUE AND (
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
  "/roster",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({ subjectId: z.coerce.number().int().positive(), date: dateOnly })
      .parse(req.query);
    const subject = await authorizedSubject(query.subjectId, req.user);
    const students = await pool.query(
      `SELECT s.id, s.student_id AS "studentId", s.roll_number AS "rollNumber", s.full_name AS "fullName",
            s.profile_photo AS "profilePhoto", a.id AS "attendanceId", a.status
     FROM students s LEFT JOIN attendance a ON a.student_id = s.id AND a.subject_id = $1 AND a.attendance_date = $2
     WHERE s.is_active = TRUE AND s.class_name = $3 AND s.semester = $4
     ORDER BY s.roll_number, s.full_name`,
      [query.subjectId, query.date, subject.className, subject.semester],
    );
    res.json({
      success: true,
      data: { subject, date: query.date, students: students.rows },
    });
  }),
);

router.get(
  "/summary",
  requireAuth,
  requireRole("ADMIN", "TEACHER", "STUDENT"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({ studentId: z.coerce.number().int().positive().optional() })
      .parse(req.query);
    let studentId = query.studentId;
    if (req.user.role === "STUDENT") {
      const own = await pool.query(
        "SELECT id FROM students WHERE user_id = $1 AND is_active = TRUE",
        [req.user.id],
      );
      if (!own.rowCount)
        throw new AppError(403, "Student profile is unavailable.");
      studentId = Number(own.rows[0].id);
      if (query.studentId && Number(query.studentId) !== studentId)
        throw new AppError(403, "You can only view your own attendance.");
    }
    if (!studentId) throw new AppError(400, "A studentId is required.");
    await authorizedStudent(studentId, req.user);
    let teacherId = null;
    if (req.user.role === "TEACHER") {
      const teacher = await pool.query(
        "SELECT id FROM teachers WHERE user_id = $1 AND is_active = TRUE",
        [req.user.id],
      );
      if (!teacher.rowCount)
        throw new AppError(403, "Teacher profile is unavailable.");
      teacherId = teacher.rows[0].id;
    }
    const scopedParams = teacherId ? [studentId, teacherId] : [studentId];
    const overallFrom = teacherId
      ? "FROM attendance a JOIN subjects scope_su ON scope_su.id = a.subject_id WHERE a.student_id = $1 AND scope_su.teacher_id = $2"
      : "FROM attendance WHERE student_id = $1";
    const subjectScope = teacherId ? "AND su.teacher_id = $2" : "";
    const [overall, subjectRows, setting] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present ${overallFrom}`,
        scopedParams,
      ),
      pool.query(
        `SELECT su.id AS "subjectId", su.subject_code AS "subjectCode", su.subject_name AS "subjectName",
                       COUNT(a.id)::int AS total, COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS present,
                       COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')::int AS absent
                FROM subjects su LEFT JOIN attendance a ON a.subject_id = su.id AND a.student_id = $1
                WHERE su.class_name = (SELECT class_name FROM students WHERE id = $1)
                  AND su.semester = (SELECT semester FROM students WHERE id = $1) ${subjectScope}
                GROUP BY su.id ORDER BY su.subject_name`,
        scopedParams,
      ),
      pool.query(
        "SELECT setting_value FROM settings WHERE setting_key = 'low_attendance_threshold'",
      ),
    ]);
    const totals = overall.rows[0];
    res.json({
      success: true,
      data: {
        studentId,
        overall: {
          total: totals.total,
          present: totals.present,
          absent: totals.total - totals.present,
          attendancePercentage: attendancePercentage(
            totals.present,
            totals.total,
          ),
        },
        lowAttendanceThreshold: Number(
          setting.rows[0]?.setting_value ??
            process.env.LOW_ATTENDANCE_THRESHOLD ??
            75,
        ),
        subjects: subjectRows.rows.map((row) => ({
          ...row,
          attendancePercentage: attendancePercentage(row.present, row.total),
        })),
      },
    });
  }),
);

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "TEACHER", "STUDENT"),
  asyncHandler(async (req, res) => {
    const query = historyQuery.parse(req.query);
    const params = [];
    const add = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where = [];
    if (req.user.role === "STUDENT")
      where.push(`st.user_id = ${add(req.user.id)}`);
    if (req.user.role === "TEACHER") {
      const userId = add(req.user.id);
      where.push(`EXISTS (SELECT 1 FROM subjects auth_su JOIN teachers auth_t ON auth_t.id = auth_su.teacher_id
       WHERE auth_su.id = a.subject_id AND auth_su.is_active = TRUE AND auth_t.user_id = ${userId}
         AND auth_su.class_name = st.class_name AND auth_su.semester = st.semester)`);
    }
    if (query.studentId) where.push(`st.id = ${add(query.studentId)}`);
    if (query.subjectId) where.push(`a.subject_id = ${add(query.subjectId)}`);
    if (query.className) where.push(`st.class_name = ${add(query.className)}`);
    if (query.semester) where.push(`st.semester = ${add(query.semester)}`);
    if (query.date) where.push(`a.attendance_date = ${add(query.date)}`);
    if (query.from) where.push(`a.attendance_date >= ${add(query.from)}`);
    if (query.to) where.push(`a.attendance_date <= ${add(query.to)}`);
    if (query.status) where.push(`a.status = ${add(query.status)}`);
    if (query.q) {
      const token = add(`%${query.q}%`);
      where.push(
        `(st.full_name ILIKE ${token} OR st.roll_number ILIKE ${token} OR st.student_id ILIKE ${token} OR su.subject_name ILIKE ${token} OR su.subject_code ILIKE ${token})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM attendance a
    JOIN students st ON st.id = a.student_id JOIN subjects su ON su.id = a.subject_id ${whereSql}`,
      params,
    );
    const limitToken = add(query.limit);
    const offsetToken = add((query.page - 1) * query.limit);
    const rows = await pool.query(
      `SELECT a.id, a.attendance_date::text AS date, a.status, a.student_id AS "studentId",
       st.full_name AS "studentName", st.student_id AS "studentCode", st.roll_number AS "rollNumber",
       su.id AS "subjectId", su.subject_code AS "subjectCode", su.subject_name AS "subjectName",
       u.email AS "markedByEmail", COALESCE(t.full_name, CASE WHEN u.role = 'ADMIN' THEN 'Administrator' END) AS "markedByName"
     FROM attendance a JOIN students st ON st.id = a.student_id
     JOIN subjects su ON su.id = a.subject_id LEFT JOIN users u ON u.id = a.marked_by
     LEFT JOIN teachers t ON t.user_id = u.id ${whereSql}
     ORDER BY a.attendance_date DESC, st.roll_number ASC LIMIT ${limitToken} OFFSET ${offsetToken}`,
      params,
    );
    res.json({
      success: true,
      data: {
        records: rows.rows,
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

const batchSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  attendanceDate: dateOnly,
  records: z
    .array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        status: statusSchema,
      }),
    )
    .min(1)
    .max(1000)
    .superRefine((records, context) => {
      const ids = records.map((record) => record.studentId);
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each student can appear only once.",
          path: [],
        });
    }),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const body = batchSchema.parse(req.body);
    const subject = await authorizedSubject(body.subjectId, req.user);
    const studentIds = body.records.map((record) => record.studentId);
    const validStudents = await pool.query(
      `SELECT id FROM students WHERE id = ANY($1::bigint[]) AND is_active = TRUE AND class_name = $2 AND semester = $3`,
      [studentIds, subject.className, subject.semester],
    );
    if (validStudents.rowCount !== studentIds.length)
      throw new AppError(
        400,
        "Every student must be active and belong to the selected subject class and semester.",
      );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const record of body.records) {
        await client.query(
          `INSERT INTO attendance (student_id, subject_id, attendance_date, status, marked_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, subject_id, attendance_date) DO UPDATE
         SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()`,
          [
            record.studentId,
            body.subjectId,
            body.attendanceDate,
            record.status,
            req.user.id,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json({
      success: true,
      data: { saved: body.records.length, correctedExisting: true },
    });
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  asyncHandler(async (req, res) => {
    const id = positiveId(req.params.id);
    const body = z.object({ status: statusSchema }).parse(req.body);
    const existing = await pool.query(
      `SELECT a.id, su.teacher_id AS "teacherId" FROM attendance a JOIN subjects su ON su.id = a.subject_id
     WHERE a.id = $1 AND su.is_active = TRUE`,
      [id],
    );
    if (!existing.rowCount)
      throw new AppError(404, "Attendance record not found.");
    if (req.user.role === "TEACHER") {
      const teacher = await pool.query(
        "SELECT id FROM teachers WHERE user_id = $1 AND is_active = TRUE",
        [req.user.id],
      );
      if (
        !teacher.rowCount ||
        String(existing.rows[0].teacherId) !== String(teacher.rows[0].id)
      )
        throw new AppError(403, "You are not assigned to this subject.");
    }
    const updated = await pool.query(
      "UPDATE attendance SET status = $1, marked_by = $2, updated_at = NOW() WHERE id = $3 RETURNING id, status",
      [body.status, req.user.id, id],
    );
    res.json({ success: true, data: updated.rows[0] });
  }),
);

module.exports = router;
