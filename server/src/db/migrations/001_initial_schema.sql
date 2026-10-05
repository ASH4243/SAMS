CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  employee_id VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  student_id VARCHAR(64) NOT NULL UNIQUE,
  unique_id VARCHAR(64) NOT NULL UNIQUE,
  roll_number VARCHAR(64) NOT NULL,
  enrollment_number VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  parents_name VARCHAR(160),
  blood_group VARCHAR(3) CHECK (blood_group IS NULL OR blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  class_name VARCHAR(100) NOT NULL,
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 12),
  profile_photo VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_name, semester, roll_number)
);

CREATE TABLE IF NOT EXISTS subjects (
  id BIGSERIAL PRIMARY KEY,
  subject_code VARCHAR(32) NOT NULL,
  subject_name VARCHAR(160) NOT NULL,
  class_name VARCHAR(100) NOT NULL,
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 12),
  teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_code, class_name, semester)
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status VARCHAR(8) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
  marked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_name ON students (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_students_class_semester ON students (class_name, semester) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects (teacher_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_subject_date ON attendance (subject_id, attendance_date DESC);

INSERT INTO settings (setting_key, setting_value)
VALUES ('low_attendance_threshold', '75')
ON CONFLICT (setting_key) DO NOTHING;
