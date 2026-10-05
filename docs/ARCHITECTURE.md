# Architecture

## Runtime flow

```text
React + Vite (client)
        │ same-origin /api requests (development proxy in Vite)
        ▼
Express REST API (server/src/app.js)
        │ auth → role/scope checks → Zod validation → route/controller logic
        ▼
node-postgres pool (parameterized SQL, transactions)
        ▼
PostgreSQL
```

In development, `npm run dev` starts Express on port 5000 and Vite on port 5173. Vite proxies `/api` to Express, so browser code uses relative API URLs rather than reaching a local service directly. In production, run `npm run build` followed by `npm start`; Express serves `client/dist` and the API from one origin. Windows and Linux use the same npm scripts and Node APIs.

## Code layout

```text
client/
  src/App.jsx                 Routes and role-based page access
  src/auth.jsx                Session context and session-expiry behavior
  src/api.js                  Shared fetch, cookie credentials, error handling
  src/components.jsx          Layout, navigation, fields, tables, states
  src/pages/                  Dashboard, account, directory and attendance pages
  src/styles.css              Responsive application styling
server/
  src/app.js                  Express middleware, route registration, static SPA
  src/server.js               Startup checks, listener and shutdown
  src/middleware/auth.js      JWT session and role guards
  src/routes/                 REST handlers and database operations
  src/lib/                    Validation, uploads, attendance helpers, errors
  src/db/migrations/          Ordered PostgreSQL migrations
  src/db/                     Pool, migration runner, seed/bootstrap commands
docs/                         API, database and architecture documentation
```

The project uses plain JavaScript to keep the BCA viva explanation and onboarding straightforward. Zod schemas validate input at the API boundary; database constraints remain the final integrity guard.

## Authentication and authorization

- Passwords are bcrypt-hashed before insertion. Login verifies credentials and issues an eight-hour JWT in an HTTP-only cookie; the token is not stored in browser local storage.
- `requireAuth` verifies the token, then reloads the current active user and role from PostgreSQL. Disabled accounts and role changes therefore take effect without trusting stale role data in a token.
- `requireRole` protects administrative and teacher-only operations on the server. Frontend role routes are only a navigation/usability layer; they are not the security boundary.
- Student endpoints bind access to the signed-in user's student row. Teacher access is restricted to classes/semesters with an active subject assignment. Attendance and summaries additionally scope to assigned subjects. Inaccessible student records return `404` to avoid disclosing their existence.
- Login attempts are rate-limited. Production cookies are `Secure`, same-site, and HTTP-only; Helmet headers and a production CORS allowlist are enabled.

## Attendance workflow

1. The teacher selects an assigned subject and date.
2. `GET /attendance/roster` checks teacher/subject assignment and selects active students whose class and semester match the subject. Any existing marks for that date are returned so a correction is visible.
3. The frontend requires one status for every displayed student. `POST /attendance` validates the full batch and student/class/semester membership, then writes the batch in a PostgreSQL transaction.
4. The unique `(student_id, subject_id, attendance_date)` constraint prevents duplicates. On conflict, the batch endpoint updates the existing mark as the explicit edit/correction mechanism. `PUT /attendance/:id` corrects one authorized row.
5. A shared backend calculation returns `present / total × 100`, rounded to one decimal. Dashboards and summaries read persisted records; there are no permanent dashboard fixtures.

## File uploads

Photos use in-memory Multer handling with a 4 MB cap, signature/MIME/extension checks for JPEG, PNG, and WebP, generated UUID filenames, and a configurable upload directory. PostgreSQL stores only the opaque generated filename. The upload endpoint is authenticated and scoped to the student owner or an authorized staff user; photo reads are protected API streams, not public static paths. Replacement stores the new file, commits the database reference, then removes the previous file. Configure persistent private storage and backups for production.

## Future face-recognition integration

Face recognition is **not implemented**. Uploading a normal student photo only updates a profile image; it does not identify a person or mark attendance. The current attendance API remains the source of truth. A future module can be introduced behind a separate recognition service boundary:

```text
camera client → attendance API → optional face-recognition service
              → verified student ID → existing attendance service → PostgreSQL
```

The integration should return a proposed identity/confidence to an authorized attendance workflow, enforce consent and retention rules, and reuse current roster checks and unique attendance keys. QR attendance, reporting exports, notification services, and mobile clients can similarly call the REST API without changing the core relational model.
