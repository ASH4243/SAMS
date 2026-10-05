"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/config/env");

const enabled = Boolean(
  process.env.TEST_DATABASE_URL && process.env.ALLOW_TEST_DB_RESET === "true",
);

test(
  "REST authentication, permissions, student CRUD, subjects, attendance and summaries",
  {
    skip: enabled
      ? false
      : "Set TEST_DATABASE_URL and ALLOW_TEST_DB_RESET=true to run destructive API integration tests.",
  },
  async (t) => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ||
      "test-secret-only-for-local-integration-tests-32-chars";
    const { pool } = require("../src/db/pool");
    t.after(async () => pool.end());
    const { migrate } = require("../src/db/migrate");
    const { seed } = require("../src/db/seed");
    const { app } = require("../src/app");
    const supertest = require("supertest");
    const request = supertest(app);
    let admin;
    let teacher;
    let student;
    let studentId;
    let peerStudentId;

    await migrate();
    const testConnection = await pool.query(
      "SELECT current_database() AS name",
    );
    assert.match(
      testConnection.rows[0].name,
      /test/i,
      'The integration DB name must include "test" as a safety check.',
    );
    await pool.query(
      "TRUNCATE attendance, subjects, students, teachers, settings, users RESTART IDENTITY CASCADE",
    );
    await seed();
    admin = supertest.agent(app);
    teacher = supertest.agent(app);
    student = supertest.agent(app);

    await t.test(
      "rejects anonymous requests and authenticates a seeded administrator",
      async () => {
        const anonymous = await request.get("/api/students");
        assert.equal(anonymous.status, 401);
        const wrongPassword = await admin
          .post("/api/auth/login")
          .send({
            email: "admin@attendance.local",
            password: "incorrect-password",
          });
        assert.equal(wrongPassword.status, 401);
        const login = await admin
          .post("/api/auth/login")
          .send({ email: "admin@attendance.local", password: "Admin@123" });
        assert.equal(login.status, 200);
        assert.equal(login.body.data.user.role, "ADMIN");
      },
    );

    await t.test(
      "creates, retrieves, updates, and isolates student records",
      async () => {
        const created = await admin.post("/api/students").send({
          email: "integration.student@attendance.local",
          password: "Student@123",
          studentId: "IT-STU-1",
          uniqueId: "IT-UNIQUE-1",
          rollNumber: "900",
          enrollmentNumber: "IT-ENR-1",
          fullName: "Integration Student",
          parentsName: "Test Guardian",
          bloodGroup: "A+",
          className: "BCA",
          semester: 5,
        });
        assert.equal(created.status, 201);
        studentId = created.body.data.id;
        const listed = await admin
          .get("/api/students")
          .query({ q: "Integration Student" });
        assert.equal(listed.status, 200);
        assert.equal(
          listed.body.data.students[0].fullName,
          "Integration Student",
        );
        const fetched = await admin.get(`/api/students/${studentId}`);
        assert.equal(fetched.body.data.student.enrollmentNumber, "IT-ENR-1");
        const changed = await admin
          .put(`/api/students/${studentId}`)
          .send({ fullName: "Updated Integration Student" });
        assert.equal(changed.status, 200);
        const after = await admin.get(`/api/students/${studentId}`);
        assert.equal(
          after.body.data.student.fullName,
          "Updated Integration Student",
        );
        const peer = await admin
          .get("/api/students")
          .query({ q: "Alex Rivera" });
        peerStudentId = peer.body.data.students[0].id;
        const studentLogin = await student
          .post("/api/auth/login")
          .send({
            email: "integration.student@attendance.local",
            password: "Student@123",
          });
        assert.equal(studentLogin.status, 200);
        assert.equal(
          (await student.get(`/api/students/${peerStudentId}`)).status,
          404,
        );
        assert.equal((await student.get("/api/students")).status, 403);
      },
    );

    await t.test(
      "creates a subject and records a correction without duplicate attendance rows",
      async () => {
        const teacherLogin = await teacher
          .post("/api/auth/login")
          .send({ email: "teacher@attendance.local", password: "Teacher@123" });
        assert.equal(teacherLogin.status, 200);
        const listTeachers = await admin.get("/api/teachers");
        const teacherId = listTeachers.body.data.teachers[0].id;
        const subject = await admin
          .post("/api/subjects")
          .send({
            subjectCode: "IT-TEST-1",
            subjectName: "Integration Testing",
            className: "BCA",
            semester: 5,
            teacherId,
          });
        assert.equal(subject.status, 201);
        const today = new Date().toISOString().slice(0, 10);
        const payload = {
          subjectId: subject.body.data.id,
          attendanceDate: today,
          records: [{ studentId, status: "PRESENT" }],
        };
        assert.equal(
          (await teacher.post("/api/attendance").send(payload)).status,
          201,
        );
        assert.equal(
          (
            await teacher
              .post("/api/attendance")
              .send({ ...payload, records: [{ studentId, status: "ABSENT" }] })
          ).status,
          201,
        );
        const count = await pool.query(
          "SELECT COUNT(*)::int AS count FROM attendance WHERE student_id = $1 AND subject_id = $2 AND attendance_date = $3",
          [studentId, subject.body.data.id, today],
        );
        assert.equal(count.rows[0].count, 1);
        const history = await teacher
          .get("/api/attendance")
          .query({
            q: "IT-TEST-1",
            from: today,
            to: today,
            className: "BCA",
            semester: 5,
          });
        assert.equal(history.status, 200);
        assert.equal(history.body.data.pagination.total, 1);
        const duplicateInBatch = await teacher.post("/api/attendance").send({
          ...payload,
          records: [
            { studentId, status: "PRESENT" },
            { studentId, status: "ABSENT" },
          ],
        });
        assert.equal(duplicateInBatch.status, 400);
        const summary = await admin
          .get("/api/attendance/summary")
          .query({ studentId });
        assert.equal(summary.status, 200);
        const subjectSummary = summary.body.data.subjects.find(
          (record) => record.subjectId === subject.body.data.id,
        );
        assert.equal(subjectSummary.total, 1);
        assert.equal(subjectSummary.attendancePercentage, 0);
        const blocked = await student
          .get("/api/attendance/summary")
          .query({ studentId: peerStudentId });
        assert.equal(blocked.status, 403);
      },
    );
  },
);
