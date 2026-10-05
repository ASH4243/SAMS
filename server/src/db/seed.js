"use strict";

require("../config/env");
const bcrypt = require("bcryptjs");
const { pool } = require("./pool");

async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed data is disabled in production.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const passwordHashes = {
      admin: await bcrypt.hash("Admin@123", 10),
      teacher: await bcrypt.hash("Teacher@123", 10),
      student: await bcrypt.hash("Student@123", 10),
    };
    const upsertUser = async (email, role, passwordHash) => {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           is_active = TRUE, updated_at = NOW() RETURNING id`,
        [email, passwordHash, role],
      );
      return result.rows[0].id;
    };
    await upsertUser("admin@attendance.local", "ADMIN", passwordHashes.admin);
    const teacherUserId = await upsertUser(
      "teacher@attendance.local",
      "TEACHER",
      passwordHashes.teacher,
    );
    const teacherResult = await client.query(
      `INSERT INTO teachers (user_id, employee_id, full_name, is_active)
       VALUES ($1, 'T-1001', 'Avery Morgan', TRUE)
       ON CONFLICT (employee_id) DO UPDATE SET user_id = EXCLUDED.user_id, full_name = EXCLUDED.full_name,
         is_active = TRUE, updated_at = NOW() RETURNING id`,
      [teacherUserId],
    );
    const teacherId = teacherResult.rows[0].id;

    for (let index = 1; index <= 8; index += 1) {
      const email = `student${index}@attendance.local`;
      const userId = await upsertUser(email, "STUDENT", passwordHashes.student);
      await client.query(
        `INSERT INTO students
         (user_id, student_id, unique_id, roll_number, enrollment_number, full_name, parents_name, blood_group, class_name, semester, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BCA', 5, TRUE)
         ON CONFLICT (student_id) DO UPDATE SET user_id = EXCLUDED.user_id, full_name = EXCLUDED.full_name,
           is_active = TRUE, updated_at = NOW()`,
        [
          userId,
          `STU${String(index).padStart(4, "0")}`,
          `UID-BCA-${String(index).padStart(4, "0")}`,
          String(index).padStart(3, "0"),
          `ENR-2024-${String(index).padStart(4, "0")}`,
          [
            "Alex Rivera",
            "Jordan Lee",
            "Sam Patel",
            "Taylor Brooks",
            "Casey Nguyen",
            "Morgan Chen",
            "Riley Shah",
            "Jamie Park",
          ][index - 1],
          `Parent ${index}`,
          ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"][index - 1],
        ],
      );
    }

    const subjects = [
      ["BCA501", "Database Management Systems"],
      ["BCA502", "Web Application Development"],
      ["BCA503", "Computer Networks"],
      ["BCA504", "Software Engineering"],
    ];
    const subjectIds = [];
    for (const [code, subjectName] of subjects) {
      const result = await client.query(
        `INSERT INTO subjects (subject_code, subject_name, class_name, semester, teacher_id, is_active)
         VALUES ($1, $2, 'BCA', 5, $3, TRUE)
         ON CONFLICT (subject_code, class_name, semester) DO UPDATE SET subject_name = EXCLUDED.subject_name,
           teacher_id = EXCLUDED.teacher_id, is_active = TRUE, updated_at = NOW() RETURNING id`,
        [code, subjectName, teacherId],
      );
      subjectIds.push(result.rows[0].id);
    }

    const studentRows = await client.query(
      "SELECT id, student_id FROM students WHERE class_name = $1 AND semester = 5 ORDER BY student_id",
      ["BCA"],
    );
    for (const [dayIndex, offset] of Array.from({ length: 24 }, (_, index) => [
      index,
      index + 1,
    ])) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - offset);
      const dateText = date.toISOString().slice(0, 10);
      for (const student of studentRows.rows) {
        const studentNumber = Number(String(student.student_id).slice(-4));
        for (
          let subjectIndex = 0;
          subjectIndex < subjectIds.length;
          subjectIndex += 1
        ) {
          const status =
            (studentNumber + dayIndex + subjectIndex) % 10 < 8
              ? "PRESENT"
              : "ABSENT";
          await client.query(
            `INSERT INTO attendance (student_id, subject_id, attendance_date, status, marked_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, subject_id, attendance_date) DO UPDATE
             SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()`,
            [
              student.id,
              subjectIds[subjectIndex],
              dateText,
              status,
              teacherUserId,
            ],
          );
        }
      }
    }

    await client.query(
      `INSERT INTO settings (setting_key, setting_value) VALUES ('low_attendance_threshold', $1)
       ON CONFLICT (setting_key) DO NOTHING`,
      [String(process.env.LOW_ATTENDANCE_THRESHOLD || 75)],
    );
    await client.query("COMMIT");
    console.log(
      "Development seed applied. Accounts: admin@attendance.local, teacher@attendance.local, student1@attendance.local.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error("Database seed failed:", error.message);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = { seed };
