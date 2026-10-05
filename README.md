# Smart Student Attendance System

A responsive, role-based attendance management application for a BCA project. It combines a React/Vite client, Express REST API, and PostgreSQL data store. This repository contains a real database-backed application; dashboards, attendance summaries, student records, and history are loaded from PostgreSQL rather than fixed browser data.

## Features

- Secure sign-in with bcrypt password hashing, HTTP-only JWT cookies, account deactivation, login rate limiting, and server-side role/scope checks.
- Admin dashboard with live student, teacher, subject, present/absent, overall attendance, trend, and low-attendance information.
- Teacher dashboard with assigned subjects, roster sizes, today's marks, and low-attendance students in assigned classes.
- Student dashboard with personal attendance, active subject breakdown, profile information, and private photo upload.
- Student and teacher account management; subject creation, assignment, editing and deactivation.
- Paginated, server-side search for students, teachers, subjects, and attendance history.
- Attendance roster by subject/date, mark-all controls, individual status updates, batch save, and authorized corrections.
- Attendance history filters for student/subject/class/semester/date range/status.
- Configurable low-attendance threshold; image upload validation and protected photo delivery.
- Responsive, mobile-friendly navigation and reusable form, table, loading, empty, status, and error states.
- PostgreSQL migrations, optional development seed, first-admin bootstrap utility, automated tests, and API/schema documentation.

**Face recognition is not implemented.** A profile photo upload is only a photo upload; it does not recognize a face or mark attendance. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a future integration boundary.

## Technology

- Node.js 22.12+ (or Node.js 24 LTS) and npm
- React 18, React Router 7, Vite 8, JavaScript, CSS
- Node.js/Express 4, Zod, `pg`, bcryptjs, JWT, Multer 2
- PostgreSQL 14+ (15+ recommended)
- Vitest, React Testing Library, Node's built-in test runner, Supertest

No Docker, WSL, Bash, Linux filesystem path, or platform-specific start script is required. Use PowerShell, Command Prompt, or a Linux terminal with the same npm commands.

## Architecture and folder structure

```text
client/                   React/Vite application
  src/pages/               Login, dashboards, directories, profiles, attendance
  src/api.js                Shared API service; same-origin /api requests
  src/auth.jsx              Session context and protected-route state
  src/components.jsx        Shared layout and UI components
  src/styles.css            Responsive styling
server/                   Express API and PostgreSQL access
  src/routes/               REST resources and authorization scope
  src/middleware/            JWT authentication and role checks
  src/lib/                   Validation, uploads, errors, attendance calculation
  src/db/migrations/         Ordered SQL migrations
  src/db/                    Pool, migration, seed and admin bootstrap commands
  uploads/                   Private runtime profile-photo storage (git-ignored)
docs/                      API, database and architecture reference
scripts/setup-env.js        Cross-platform .env initializer
```

The request path is **React → REST API → route/validation/authorization → parameterized SQL and transactions → PostgreSQL**. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DATABASE.md](docs/DATABASE.md).

## Prerequisites

1. Install Node.js **22.12 or newer** (or Node.js 24 LTS); npm is included.
2. Install PostgreSQL 14 or newer and ensure the PostgreSQL service is running.
3. Use pgAdmin or install the PostgreSQL command-line tools (`psql`).
4. Git and an editor such as VS Code are recommended.

## Windows 10/11 setup (PowerShell or Command Prompt)

1. Clone and install from the repository root:

   ```text
   git clone https://github.com/ASH4243/SAMS.git
   cd SAMS
   npm install
   ```

2. Create a PostgreSQL database using pgAdmin (`Databases` → `Create` → `Database…`, name it `student_attendance`) **or** from a terminal where `psql` is on PATH:

   ```text
   psql -U postgres -c "CREATE DATABASE student_attendance;"
   ```

   Enter your local PostgreSQL password when prompted. If the database already exists, do not run the create command again.

3. Create the environment file with the cross-platform Node script:

   ```text
   npm run setup:env
   ```

   Edit `.env` in VS Code. Set `DATABASE_URL` to your local PostgreSQL account/database and replace `JWT_SECRET` with a private value of at least 32 characters. You can generate a value in either PowerShell or Command Prompt with:

   ```text
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Example connection string (replace the username/password):

   ```text
   DATABASE_URL=postgresql://postgres:your_password@localhost:5432/student_attendance
   ```

   If the password contains URL-reserved characters, URL-encode it. Keep `.env` private; it is ignored by Git.

4. Apply the schema and (optionally) insert development data:

   ```text
   npm run db:migrate
   npm run db:seed
   ```

   `db:seed` is optional, idempotent development data. It refuses to run with `NODE_ENV=production`.

5. Start both the API and frontend:

   ```text
   npm run dev
   ```

   Open **http://localhost:5173**. The Vite server proxies `/api` requests to Express on port 5000.

The commands above also work in a Linux terminal. Do not use `createdb`, `cp`, or shell-specific environment assignment if you want to follow exactly the same setup flow on every platform; pgAdmin/`psql` plus `npm run setup:env` are sufficient.

## Linux setup

Install Node.js 22.12+/24 LTS and PostgreSQL 14+ from your distribution's supported packages. Then follow the same numbered setup above from a terminal. `psql -U postgres -c "CREATE DATABASE student_attendance;"`, `npm run setup:env`, migrations, seed, and `npm run dev` use the same project scripts. Configure PostgreSQL role/password access for the local account in `DATABASE_URL`.

## Environment variables

`.env.example` is the complete template. `npm run setup:env` copies it to `.env` without overwriting an existing file.

| Variable                                            | Purpose                                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                          | `development`, `test`, or `production`. Production enables secure cookies, stricter CORS, and suppresses request logs. |
| `PORT`                                              | Express port; default `5000`.                                                                                          |
| `DATABASE_URL`                                      | PostgreSQL URL.                                                                                                        |
| `JWT_SECRET`                                        | Private signing secret; required to be at least 32 characters.                                                         |
| `CLIENT_URL`                                        | Main permitted browser origin, default `http://localhost:5173`.                                                        |
| `CORS_ORIGINS`                                      | Optional comma-separated extra production origins. Keep the list explicit in production.                               |
| `UPLOAD_DIR`                                        | Private photo directory; relative paths resolve from the project root. Default `server/uploads`.                       |
| `LOW_ATTENDANCE_THRESHOLD`                          | New-setting fallback (default `75`); the admin UI persists the live value in PostgreSQL.                               |
| `DB_POOL_SIZE`                                      | Optional maximum PostgreSQL connections; default `10`.                                                                 |
| `DATABASE_SSL`                                      | Set to `true` when the PostgreSQL provider requires validated TLS.                                                     |
| `TEST_DATABASE_URL`                                 | Optional **disposable** PostgreSQL database for destructive integration tests.                                         |
| `ALLOW_TEST_DB_RESET`                               | Must be exactly `true` to permit the integration suite to truncate its test database.                                  |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | Temporary first-admin provisioning values; remove them after bootstrap. Password minimum is 12 characters.             |

The Vite proxy target can be overridden with `VITE_API_PROXY_TARGET`; browser code still uses relative `/api` paths.

## Database migration and seed

```text
npm run db:migrate
npm run db:seed
```

Migrations are repeatable: an internal ledger prevents an applied file from running again. To roll out schema updates, add a new ordered `.sql` migration; do not edit one already applied in a shared environment.

Seeded **development-only** accounts (all passwords are for local testing only):

| Role    | Email                       | Password      |
| ------- | --------------------------- | ------------- |
| Admin   | `admin@attendance.local`    | `Admin@123`   |
| Teacher | `teacher@attendance.local`  | `Teacher@123` |
| Student | `student1@attendance.local` | `Student@123` |

The seed adds eight BCA Semester 5 students, four subjects, and attendance records. It may be rerun safely; data is clearly identified as development/test data. Do not seed production.

### First administrator in a fresh production database

After migrations, a non-seeded production database has no users by design. Provision the first admin without embedding a default production password:

1. Temporarily set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the private `.env` (or your secret environment manager). Choose a unique email and a password of at least 12 characters.
2. Run `npm run db:create-admin`. The command only creates an admin if no active administrator exists.
3. Remove both bootstrap variables from `.env`/the environment immediately. Do not commit or log them.

Use the development seed accounts only for local evaluation. For a new production deployment, first-admin bootstrap is required.

## Run and build

Development (client + API):

```text
npm run dev
```

Production bundle and single-origin server:

```text
npm run build
npm start
```

The production server expects the production environment variables, a migrated PostgreSQL database, `NODE_ENV=production`, TLS termination at a trusted reverse proxy, and persistent private upload storage. It serves the built client from `client/dist` and the API from the same origin. If setting variables directly in a terminal, use that shell's documented syntax; editing `.env` or setting variables in the deployment manager works across platforms.

## Tests, lint, formatting

```text
npm test
npm run lint
npm run format
```

`npm test` runs backend unit tests, the React/Vitest component tests (login, dashboard, student profile, and protected route), and an optional real-PostgreSQL API integration test. Without explicit test DB settings, the destructive integration suite is skipped. To enable it, create a **disposable** database named e.g. `student_attendance_test`, set `TEST_DATABASE_URL` to it and `ALLOW_TEST_DB_RESET=true` in `.env`, then run `npm test`. The API integration suite verifies authentication, role isolation, student create/read/update, subject creation, attendance correction/unique-row behavior, and calculations; it truncates tables in that named test database. Never point it at development or production data.

## User roles and navigation

- **Admin:** live dashboard, student CRUD/deactivation, teacher CRUD/deactivation, subject CRUD/deactivation and teacher assignment, attendance correction/history, and threshold settings.
- **Teacher:** assigned subjects, class-scoped student search/profile, mark/correct attendance, history and low-attendance views.
- **Student:** own dashboard, profile/photo update, overall/subject attendance, and own history only.

The server enforces these rules for APIs even if a client route is manually entered.

## API documentation

See [docs/API.md](docs/API.md) for route methods, permissions, request fields, query filters, response envelopes, and error codes. Health check: `GET /api/health`.

## Troubleshooting

- **`DATABASE_URL is required` / connection refused:** confirm `.env` exists, PostgreSQL is running, the database exists, and credentials/port in the URL are correct.
- **`password authentication failed`:** check the PostgreSQL username/password. URL-encode reserved characters in the URL password.
- **`relation does not exist`:** run `npm run db:migrate` after selecting the correct database.
- **Port already in use:** set a free `PORT` in `.env`; for Vite, stop the process using port 5173 or configure Vite's port in `client/vite.config.js`.
- **Browser cannot reach `/api`:** when using `npm run dev`, leave the Vite proxy enabled and keep the API on `PORT=5000` unless you also change `VITE_API_PROXY_TARGET`.
- **Photo request returns 404:** check that the profile has a stored photo and that `UPLOAD_DIR` persists between restarts; do not expose the upload directory as a public static folder.
- **Integration tests skipped:** only expected when `TEST_DATABASE_URL` and `ALLOW_TEST_DB_RESET=true` have not been configured.

## Production considerations

- Use a dedicated least-privilege PostgreSQL role, strong private `JWT_SECRET`, TLS, explicit production CORS origins, secure deployment secrets, database backups, and persistent restricted upload storage.
- Run migrations as a release step. Do not run `db:seed` on production.
- Create the first admin using the documented one-time bootstrap command; remove temporary credentials immediately.
- Review institutional privacy/retention rules for student identifiers and photos. The current app does not implement face recognition, parent access, notifications, exports, or password reset.
- Monitor server and database health; arrange centralized log retention without recording credentials or passwords.
