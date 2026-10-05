"use strict";

const express = require("express");
const { pool } = require("../db/pool");
const { AppError, asyncHandler } = require("../lib/errors");
const { attendancePercentage } = require("../lib/attendance");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

async function threshold() {
  const result = await pool.query(
    "SELECT setting_value FROM settings WHERE setting_key = 'low_attendance_threshold'",
  );
  return Number(
    result.rows[0]?.setting_value ?? process.env.LOW_ATTENDANCE_THRESHOLD ?? 75,
  );
}

router.get(
  "/admin",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const [students, teachers, subjects, today, overall, cutoff, trend] =
      await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS count FROM students WHERE is_active = TRUE",
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM teachers WHERE is_active = TRUE",
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM subjects WHERE is_active = TRUE",
        ),
        pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present,
                       COUNT(*) FILTER (WHERE status = 'ABSENT')::int AS absent
                FROM attendance a JOIN students active_student ON active_student.id = a.student_id
                WHERE a.attendance_date = CURRENT_DATE AND active_student.is_active = TRUE`),
        pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present
                FROM attendance a JOIN students active_student ON active_student.id = a.student_id
                WHERE active_student.is_active = TRUE`),
        threshold(),
        pool.query(`SELECT a.attendance_date::text AS date, COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
                       COUNT(*)::int AS total FROM attendance a JOIN students active_student ON active_student.id = a.student_id
                WHERE a.attendance_date >= CURRENT_DATE - INTERVAL '6 days' AND active_student.is_active = TRUE
                GROUP BY a.attendance_date ORDER BY a.attendance_date`),
      ]);
    const lowRows = await pool.query(
      `SELECT s.id, s.full_name AS "fullName", s.student_id AS "studentId", s.roll_number AS "rollNumber",
                                      s.class_name AS "className", s.semester, COUNT(a.id)::int AS total,
                                      COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS present
                                   FROM students s JOIN attendance a ON a.student_id = s.id
                                   WHERE s.is_active = TRUE GROUP BY s.id
                                   HAVING COUNT(a.id) FILTER (WHERE a.status = 'PRESENT') * 100.0 / NULLIF(COUNT(a.id), 0) < $1
                                   ORDER BY COUNT(a.id) FILTER (WHERE a.status = 'PRESENT') * 1.0 / COUNT(a.id) ASC
                                   LIMIT 10`,
      [cutoff],
    );
    const aggregate = overall.rows[0];
    res.json({
      success: true,
      data: {
        totals: {
          students: students.rows[0].count,
          teachers: teachers.rows[0].count,
          subjects: subjects.rows[0].count,
          presentToday: today.rows[0].present,
          absentToday: today.rows[0].absent,
          overallAttendance: attendancePercentage(
            aggregate.present,
            aggregate.total,
          ),
          totalSessions: aggregate.total,
        },
        lowAttendanceThreshold: cutoff,
        lowAttendanceStudents: lowRows.map((row) => ({
          ...row,
          attendancePercentage: attendancePercentage(row.present, row.total),
        })),
        attendanceTrend: trend.rows.map((row) => ({
          ...row,
          attendancePercentage: attendancePercentage(row.present, row.total),
        })),
      },
    });
  }),
);

router.get(
  "/teacher",
  requireRole("TEACHER"),
  asyncHandler(async (req, res) => {
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE user_id = $1 AND is_active = TRUE",
      [req.user.id],
    );
    if (!teacherResult.rowCount)
      throw new AppError(403, "Teacher profile is unavailable.");
    const teacherId = teacherResult.rows[0].id;
    const [subjectRows, studentCount, today, cutoff] = await Promise.all([
      pool.query(
        `SELECT su.id, su.subject_code AS "subjectCode", su.subject_name AS "subjectName", su.class_name AS "className", su.semester,
                       COUNT(DISTINCT st.id)::int AS "studentCount"
                FROM subjects su LEFT JOIN students st ON st.class_name = su.class_name AND st.semester = su.semester AND st.is_active = TRUE
                WHERE su.teacher_id = $1 AND su.is_active = TRUE GROUP BY su.id ORDER BY su.subject_name`,
        [teacherId],
      ),
      pool.query(
        `SELECT COUNT(DISTINCT s.id)::int AS count FROM students s JOIN subjects su
                  ON su.class_name = s.class_name AND su.semester = s.semester
                WHERE su.teacher_id = $1 AND su.is_active = TRUE AND s.is_active = TRUE`,
        [teacherId],
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
                       COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent
                FROM attendance a JOIN subjects su ON su.id = a.subject_id
                JOIN students active_student ON active_student.id = a.student_id AND active_student.is_active = TRUE
                WHERE su.teacher_id = $1 AND su.is_active = TRUE AND a.attendance_date = CURRENT_DATE`,
        [teacherId],
      ),
      threshold(),
    ]);
    const lowRows = await pool.query(
      `SELECT s.id, s.full_name AS "fullName", s.student_id AS "studentId", s.roll_number AS "rollNumber",
                                      s.class_name AS "className", s.semester, COUNT(a.id)::int AS total,
                                      COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS present
                                   FROM students s JOIN attendance a ON a.student_id = s.id
                                   JOIN subjects su ON su.id = a.subject_id
                                   WHERE s.is_active = TRUE AND su.teacher_id = $1 AND su.is_active = TRUE
                                   GROUP BY s.id
                                   HAVING COUNT(a.id) FILTER (WHERE a.status = 'PRESENT') * 100.0 / NULLIF(COUNT(a.id), 0) < $2
                                   ORDER BY COUNT(a.id) FILTER (WHERE a.status = 'PRESENT') * 1.0 / COUNT(a.id) ASC LIMIT 10`,
      [teacherId, cutoff],
    );
    res.json({
      success: true,
      data: {
        assignedSubjects: subjectRows.rows,
        totalStudents: studentCount.rows[0].count,
        presentToday: today.rows[0].present,
        absentToday: today.rows[0].absent,
        lowAttendanceThreshold: cutoff,
        lowAttendanceStudents: lowRows.map((row) => ({
          ...row,
          attendancePercentage: attendancePercentage(row.present, row.total),
        })),
      },
    });
  }),
);

router.get(
  "/student",
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    const studentResult = await pool.query(
      `SELECT id, student_id AS "studentId", unique_id AS "uniqueId", roll_number AS "rollNumber",
      enrollment_number AS "enrollmentNumber", full_name AS "fullName", parents_name AS "parentsName",
      blood_group AS "bloodGroup", class_name AS "className", semester, profile_photo AS "profilePhoto"
     FROM students WHERE user_id = $1 AND is_active = TRUE`,
      [req.user.id],
    );
    const student = studentResult.rows[0];
    if (!student) throw new AppError(403, "Student profile is unavailable.");
    const [subjects, overall, cutoff] = await Promise.all([
      pool.query(
        `SELECT su.id AS "subjectId", su.subject_code AS "subjectCode", su.subject_name AS "subjectName",
                       COUNT(a.id)::int AS total, COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS present,
                       COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')::int AS absent
                FROM subjects su LEFT JOIN attendance a ON a.subject_id = su.id AND a.student_id = $1
                WHERE su.class_name = $2 AND su.semester = $3 AND su.is_active = TRUE
                GROUP BY su.id ORDER BY su.subject_name`,
        [student.id, student.className, student.semester],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present
                FROM attendance WHERE student_id = $1`,
        [student.id],
      ),
      threshold(),
    ]);
    const total = overall.rows[0];
    const subjectBreakdown = subjects.rows.map((row) => ({
      ...row,
      attendancePercentage: attendancePercentage(row.present, row.total),
    }));
    res.json({
      success: true,
      data: {
        profile: student,
        overall: {
          total: total.total,
          present: total.present,
          absent: total.total - total.present,
          attendancePercentage: attendancePercentage(
            total.present,
            total.total,
          ),
        },
        lowAttendanceThreshold: cutoff,
        subjects: subjectBreakdown,
      },
    });
  }),
);

module.exports = router;
