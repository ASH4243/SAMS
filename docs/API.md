# REST API reference

The API is mounted at `/api`. All JSON requests and responses use UTF-8. Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "message": "...", "errors"?: [...] }`.

Authentication is an eight-hour JWT stored in the `attendance_session` HTTP-only cookie. The browser client sends it automatically with same-origin requests. Non-browser clients may instead send `Authorization: Bearer <jwt>`. Cookies are `Secure` in production and `SameSite=Lax`. A student is scoped to their own records by the server; changing a URL or query ID does not grant access.

## Roles

| Role      | Scope                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| `ADMIN`   | Institution-wide users, students, teachers, subjects, attendance, and settings. |
| `TEACHER` | Students and attendance for active subjects assigned to that teacher.           |
| `STUDENT` | Own profile, photo, attendance, and active subjects for their class/semester.   |

`—` means the route is public. IDs are positive database IDs. Dates are real calendar dates in `YYYY-MM-DD` format. Pagination uses `page` (default 1) and `limit` (default 20, maximum 100).

## Health and authentication

| Method and path     | Authentication / role                                | Request                                               | Response                                                                                                                                   |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`       | —                                                    | —                                                     | `{ data: { status: "ok" } }`; checks the PostgreSQL connection.                                                                            |
| `POST /auth/login`  | —; rate-limited to 10 attempts per 15 minutes per IP | `{ "email": "person@campus.edu", "password": "..." }` | `200`, sets the HTTP-only session cookie and returns `{ data: { user: { id, email, role, profile } } }`. Invalid credentials return `401`. |
| `POST /auth/logout` | —                                                    | —                                                     | Clears the session cookie.                                                                                                                 |
| `GET /auth/me`      | Any signed-in role                                   | —                                                     | Current account and non-sensitive role-specific profile; no password hash is returned.                                                     |

`profile` is a student or teacher profile object for those roles, and `null` for an admin.

## Dashboard

| Method and path          | Role      | Response                                                                                                                                                                                                                           |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboard/admin`   | `ADMIN`   | Active student, teacher and subject totals; today's present/absent records; overall attendance; configured low-attendance threshold; up to 10 low-attendance students; attendance records grouped by date for the last seven days. |
| `GET /dashboard/teacher` | `TEACHER` | Assigned active subjects and roster sizes, distinct active student total, today's present/absent records, configured threshold, and low-attendance students across assigned subjects.                                              |
| `GET /dashboard/student` | `STUDENT` | Own profile, overall totals and percentage, active subject breakdown, and configured threshold.                                                                                                                                    |

Counts and percentages are read/calculated from PostgreSQL on every request. With no recorded classes, a percentage is `0`.

## Students

| Method and path            | Role                                            | Request / query                                                                                                                    | Response / behavior                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /students`            | `ADMIN`, `TEACHER`                              | Optional `q`, `className`, `semester`, `page`, `limit`. `q` searches name, roll number, student ID and enrollment number.          | Paginated `students` with attendance totals/percentages and `lowAttendanceThreshold`. Teachers only receive records in classes/semesters where they have an active assigned subject. |
| `POST /students`           | `ADMIN`                                         | `{ email, password, studentId, uniqueId, rollNumber, enrollmentNumber, fullName, parentsName?, bloodGroup?, className, semester }` | `201`, creates the login and student profile atomically. Password minimum: 8 characters.                                                                                             |
| `GET /students/:id`        | `ADMIN`, authorized `TEACHER`, owning `STUDENT` | —                                                                                                                                  | Student profile and account email. Inaccessible or inactive records return `404`.                                                                                                    |
| `PUT /students/:id`        | `ADMIN`                                         | Any non-empty subset of the student fields except password.                                                                        | Updates the profile and/or account email atomically.                                                                                                                                 |
| `DELETE /students/:id`     | `ADMIN`                                         | —                                                                                                                                  | Soft-deactivates the student and login, removes the stored photo, and retains attendance history.                                                                                    |
| `POST /students/:id/photo` | `ADMIN`, authorized `TEACHER`, owning `STUDENT` | `multipart/form-data`, field `photo`; JPEG/JPG, PNG, or WebP; maximum 4 MB.                                                        | Validates file extension, declared MIME type and file signature; saves under a generated UUID name; replaces the previous file.                                                      |
| `GET /students/:id/photo`  | `ADMIN`, authorized `TEACHER`, owning `STUDENT` | —                                                                                                                                  | Streams the private image with `Cache-Control: private, no-store`. The stored photo filename is not exposed in a public static directory.                                            |

Student creation fields have reasonable maximum lengths and trim whitespace. `bloodGroup` is one of `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, or empty/null. Semester is an integer from 1–12. Email and institution identifiers are unique as enforced by PostgreSQL.

## Teachers

These endpoints require `ADMIN`.

| Method and path        | Request / query                                            | Response / behavior                                                                              |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /teachers`        | Optional `q` (name, employee ID, email), `page`, `limit`.  | Paginated active teacher accounts and active assigned-subject counts.                            |
| `POST /teachers`       | `{ email, password, employeeId, fullName }`                | `201`, creates the login and staff record in one transaction; password minimum: 8 characters.    |
| `PUT /teachers/:id`    | Any non-empty subset of `{ email, employeeId, fullName }`. | Updates teacher details.                                                                         |
| `DELETE /teachers/:id` | —                                                          | Deactivates teacher/login and unassigns their subjects; existing attendance history is retained. |

## Subjects

| Method and path        | Role               | Request / query                                                           | Response / behavior                                                                                                                                                              |
| ---------------------- | ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /subjects`        | Any signed-in role | Optional `q`, `className`, `semester`, `page`, `limit`.                   | Admins see all active subjects; teachers see assigned active subjects; students see active subjects for their own class/semester. Includes assigned teacher name when available. |
| `POST /subjects`       | `ADMIN`            | `{ subjectCode, subjectName, className, semester, teacherId? }`           | `201`, creates subject. An optional teacher must be active.                                                                                                                      |
| `PUT /subjects/:id`    | `ADMIN`            | Non-empty subset of the create fields. Set `teacherId: null` to unassign. | Updates a subject.                                                                                                                                                               |
| `DELETE /subjects/:id` | `ADMIN`            | —                                                                         | Soft-deactivates the subject; attendance rows/history remain.                                                                                                                    |

A subject is unique by subject code, class and semester. Semester is 1–12.

## Attendance

| Method and path           | Role                        | Request / query                                                                                                                              | Response / behavior                                                                                                                                                                                                                              |
| ------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /attendance/roster`  | `ADMIN`, `TEACHER`          | `subjectId`, `date`                                                                                                                          | Active students for the subject's class/semester and any existing marks for the selected date. Teacher must be assigned to the subject.                                                                                                          |
| `POST /attendance`        | `ADMIN`, `TEACHER`          | `{ subjectId, attendanceDate, records: [{ studentId, status }] }`; status is `PRESENT` or `ABSENT`; records must contain unique student IDs. | `201`; validates subject scope and every active student/class/semester. Saves the batch transactionally. Re-submitting a student's same subject/date is the explicit correction mechanism: it updates that row rather than creating a duplicate. |
| `PUT /attendance/:id`     | `ADMIN`, assigned `TEACHER` | `{ status }`                                                                                                                                 | Corrects one existing mark.                                                                                                                                                                                                                      |
| `GET /attendance`         | Any signed-in role          | Optional `studentId`, `subjectId`, `className`, `semester`, exact `date`, inclusive `from`/`to`, `status`, `q`, `page`, `limit`.             | Paginated history with subject, student, status, and marker. A student is always restricted to their own records; teachers are restricted to their assigned subjects/classes. `q` searches student identifiers/names and subject name/code.      |
| `GET /attendance/summary` | Any signed-in role          | `studentId` required for admin/teacher; optional for student (always own).                                                                   | Overall and subject-level counts, percentages, and the configured low-attendance threshold. A teacher's summary is restricted to their own assigned subjects.                                                                                    |

The database has a unique key on `(student_id, subject_id, attendance_date)`. Attendance percentage is `present / total × 100`, rounded to one decimal place. No classes yields `0.0`. Future dates are not offered in the UI; the API validates calendar dates but does not enforce an academic calendar.

## Settings

These endpoints require `ADMIN`.

| Method and path   | Request                            | Response / behavior                                                                                                   |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET /settings`   | —                                  | Returns `{ lowAttendanceThreshold }`.                                                                                 |
| `PATCH /settings` | `{ "lowAttendanceThreshold": 75 }` | Persists a decimal percentage from 0 through 100. Dashboards and low-attendance lists use this single stored setting. |

## Error status codes

- `400` — validation or malformed request.
- `401` — missing, invalid, or expired session / incorrect credentials.
- `403` — authenticated role is not permitted.
- `404` — resource is missing, inactive, or outside the caller's permitted scope.
- `409` — a unique value already exists.
- `413` — uploaded photo exceeds 4 MB.
- `429` — login rate limit exceeded.
- `500` — generic server error; stack traces and database details are never sent to clients.
