import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardCheck,
  GraduationCap,
  Percent,
  Users,
} from "lucide-react";
import { api, photoUrl } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageHeader,
  ProgressBar,
  StatCard,
  TableShell,
} from "../components";
import { formatDate, initials, percentage } from "../utils";

function AttendanceTrend({ rows = [] }) {
  const maximum = Math.max(1, ...rows.map((item) => Number(item.total)));
  return (
    <div
      className="trend-chart"
      aria-label="Attendance records for the last seven days"
    >
      {rows.length ? (
        rows.map((item) => {
          const height = Math.max(
            10,
            Math.round((Number(item.total) / maximum) * 92),
          );
          const presentHeight = Number(item.total)
            ? Math.round((height * Number(item.present)) / Number(item.total))
            : 0;
          return (
            <div
              className="trend-day"
              key={item.date}
              title={`${formatDate(item.date)} · ${item.present} present of ${item.total}`}
            >
              <div className="trend-bar" style={{ height: `${height}%` }}>
                <span style={{ height: `${presentHeight}%` }} />
              </div>
              <small>
                {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "short" },
                )}
              </small>
            </div>
          );
        })
      ) : (
        <div className="chart-empty">
          Attendance trend will appear after marks are recorded.
        </div>
      )}
    </div>
  );
}

function LowAttendanceTable({ students, threshold }) {
  return (
    <section className="panel low-panel">
      <div className="panel-heading">
        <div>
          <h2>Needs attention</h2>
          <p>Students below {threshold}% attendance</p>
        </div>
        <span className="panel-count">
          {students.length} {students.length === 1 ? "student" : "students"}
        </span>
      </div>
      {!students.length ? (
        <EmptyState
          title="All clear"
          description="No students are currently below the configured attendance threshold."
          icon={Check}
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Attendance</th>
              <th>Present / Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="table-person">
                    <span className="avatar avatar-table">
                      {initials(student.fullName)}
                    </span>
                    <span>
                      <strong>{student.fullName}</strong>
                      <small>
                        {student.studentId} · Roll {student.rollNumber}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  {student.className} · Sem {student.semester}
                </td>
                <td>
                  <span className="low-percent">
                    {percentage(student.attendancePercentage)}
                  </span>
                  <ProgressBar
                    value={student.attendancePercentage}
                    threshold={threshold}
                  />
                </td>
                <td>
                  {student.present} / {student.total}
                </td>
                <td>
                  <Link className="table-link" to={`/students/${student.id}`}>
                    View <ArrowRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const endpoint =
    user.role === "ADMIN"
      ? "/dashboard/admin"
      : user.role === "TEACHER"
        ? "/dashboard/teacher"
        : "/dashboard/student";
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get(endpoint));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <LoadingState label="Loading your dashboard…" />;
  if (error && !data) return <ErrorMessage message={error} onRetry={load} />;

  const name =
    user.profile?.fullName?.split(" ")[0] ||
    (user.role === "ADMIN" ? "there" : "there");
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  if (user.role === "STUDENT") {
    const { profile, overall, subjects, lowAttendanceThreshold } = data;
    return (
      <>
        <PageHeader
          eyebrow="STUDENT OVERVIEW"
          title={`Good to see you, ${name}.`}
          description={`${todayLabel} · Here's how your semester is going.`}
          action={
            <Link
              to={`/students/${profile.id}`}
              className="button button-secondary"
            >
              View profile <ArrowRight size={16} />
            </Link>
          }
        />
        {error && <ErrorMessage message={error} onRetry={load} />}
        <section className="student-hero panel">
          <div className="student-hero-main">
            <div className="student-avatar-wrap">
              {profile.profilePhoto ? (
                <img
                  src={photoUrl(profile.id)}
                  alt={`${profile.fullName}'s profile`}
                />
              ) : (
                <span className="avatar avatar-hero">
                  {initials(profile.fullName)}
                </span>
              )}
            </div>
            <div className="student-hero-copy">
              <span className="eyebrow">YOUR ATTENDANCE</span>
              <h2>{profile.fullName}</h2>
              <p>
                {profile.studentId} <span>·</span> Roll {profile.rollNumber}{" "}
                <span>·</span> {profile.className}, Semester {profile.semester}
              </p>
            </div>
          </div>
          <div className="student-overall">
            <div
              className="attendance-ring"
              style={{
                "--percentage": `${Math.max(0, Math.min(100, overall.attendancePercentage))}%`,
              }}
            >
              <div>
                <strong>{percentage(overall.attendancePercentage)}</strong>
                <span>overall</span>
              </div>
            </div>
            <div className="ring-caption">
              <span>{overall.present} present</span>
              <span>{overall.absent} absent</span>
            </div>
          </div>
        </section>
        <div className="section-intro">
          <div>
            <span className="eyebrow">BY SUBJECT</span>
            <h2>Your attendance record</h2>
          </div>
          <Link className="text-link" to="/attendance/history">
            Full history <ArrowRight size={15} />
          </Link>
        </div>
        <section className="subject-attendance-grid">
          {subjects.length ? (
            subjects.map((subject) => (
              <article
                className="subject-attendance-card"
                key={subject.subjectId}
              >
                <div className="subject-attendance-top">
                  <span className="subject-icon">
                    <BookOpen size={18} />
                  </span>
                  <span
                    className={
                      Number(subject.attendancePercentage) <
                      lowAttendanceThreshold
                        ? "subject-percent low"
                        : "subject-percent"
                    }
                  >
                    {percentage(subject.attendancePercentage)}
                  </span>
                </div>
                <h3>{subject.subjectName}</h3>
                <p className="subject-code">{subject.subjectCode}</p>
                <ProgressBar
                  value={subject.attendancePercentage}
                  threshold={lowAttendanceThreshold}
                />
                <div className="subject-counts">
                  <span>
                    <strong>{subject.total}</strong> classes
                  </span>
                  <span>
                    <strong>{subject.present}</strong> present
                  </span>
                  <span>
                    <strong>{subject.absent}</strong> absent
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="panel">
              <EmptyState
                title="No subject records yet"
                description="Subjects for your class will appear here once they are set up."
                icon={BookOpen}
              />
            </div>
          )}
        </section>
        <div className="notice notice-neutral">
          <CircleAlert size={17} />
          <span>
            Attendance below {lowAttendanceThreshold}% is flagged by your
            institution. Contact your teacher if you notice an incorrect mark.
          </span>
        </div>
      </>
    );
  }

  if (user.role === "ADMIN") {
    const totals = data.totals;
    return (
      <>
        <PageHeader
          eyebrow="ADMIN OVERVIEW"
          title={`Good morning, ${name}.`}
          description={`${todayLabel} · Your campus attendance at a glance.`}
          action={
            <Link to="/attendance/mark" className="button button-primary">
              <ClipboardCheck size={16} /> Mark attendance
            </Link>
          }
        />
        {error && <ErrorMessage message={error} onRetry={load} />}
        <div className="stats-grid">
          <StatCard
            label="Total students"
            value={totals.students.toLocaleString()}
            caption="Active student records"
            icon={Users}
            tone="blue"
          />
          <StatCard
            label="Teaching staff"
            value={totals.teachers.toLocaleString()}
            caption="Active teacher accounts"
            icon={GraduationCap}
            tone="violet"
          />
          <StatCard
            label="Active subjects"
            value={totals.subjects.toLocaleString()}
            caption="Across all classes"
            icon={BookOpen}
            tone="amber"
          />
          <StatCard
            label="Overall attendance"
            value={percentage(totals.overallAttendance)}
            caption={`${totals.totalSessions.toLocaleString()} marked class records`}
            icon={Percent}
            tone="green"
          />
        </div>
        <div className="dashboard-split">
          <section className="panel trend-panel">
            <div className="panel-heading">
              <div>
                <h2>Attendance activity</h2>
                <p>Recorded across the last seven days</p>
              </div>
              <span className="trend-legend">
                <i /> Present
              </span>
            </div>
            <AttendanceTrend rows={data.attendanceTrend} />
          </section>
          <section className="panel today-panel">
            <div className="panel-heading">
              <div>
                <h2>Today at a glance</h2>
                <p>Records marked for today</p>
              </div>
              <span className="today-date">
                <CalendarDays size={14} /> Today
              </span>
            </div>
            <div className="today-stat present">
              <span className="today-stat-icon">
                <Check size={17} />
              </span>
              <span>
                <strong>{totals.presentToday.toLocaleString()}</strong>
                <small>Marked present</small>
              </span>
            </div>
            <div className="today-stat absent">
              <span className="today-stat-icon">
                <CircleAlert size={17} />
              </span>
              <span>
                <strong>{totals.absentToday.toLocaleString()}</strong>
                <small>Marked absent</small>
              </span>
            </div>
            <div className="today-foot">
              {totals.presentToday + totals.absentToday} attendance records so
              far
            </div>
          </section>
        </div>
        <LowAttendanceTable
          students={data.lowAttendanceStudents}
          threshold={data.lowAttendanceThreshold}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="TEACHER OVERVIEW"
        title={`Welcome back, ${name}.`}
        description={`${todayLabel} · Your classes and attendance in one place.`}
        action={
          <Link to="/attendance/mark" className="button button-primary">
            <ClipboardCheck size={16} /> Mark attendance
          </Link>
        }
      />
      {error && <ErrorMessage message={error} onRetry={load} />}
      <div className="stats-grid stats-grid-teacher">
        <StatCard
          label="Assigned classes"
          value={data.assignedSubjects.length}
          caption="Subjects you teach"
          icon={BookOpen}
          tone="blue"
        />
        <StatCard
          label="Students"
          value={data.totalStudents}
          caption="In your assigned classes"
          icon={Users}
          tone="violet"
        />
        <StatCard
          label="Present today"
          value={data.presentToday}
          caption="Across your subjects"
          icon={Check}
          tone="green"
        />
        <StatCard
          label="Absent today"
          value={data.absentToday}
          caption="Across your subjects"
          icon={CircleAlert}
          tone="amber"
        />
      </div>
      <div className="section-intro">
        <div>
          <span className="eyebrow">YOUR TEACHING LOAD</span>
          <h2>Assigned subjects</h2>
        </div>
        <Link className="text-link" to="/subjects">
          Browse subjects <ArrowRight size={15} />
        </Link>
      </div>
      <section className="teacher-subject-grid">
        {data.assignedSubjects.length ? (
          data.assignedSubjects.map((subject) => (
            <article className="teacher-subject-card" key={subject.id}>
              <div className="subject-attendance-top">
                <span className="subject-icon">
                  <BookOpen size={18} />
                </span>
                <span className="subject-code">{subject.subjectCode}</span>
              </div>
              <h3>{subject.subjectName}</h3>
              <p>
                {subject.className} · Semester {subject.semester}
              </p>
              <div className="teacher-subject-footer">
                <span>
                  <Users size={15} /> {subject.studentCount} students
                </span>
                <Link to={`/attendance/mark?subjectId=${subject.id}`}>
                  Take attendance <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="panel">
            <EmptyState
              title="No subjects assigned yet"
              description="Ask an administrator to assign a subject to your account."
              icon={BookOpen}
            />
          </div>
        )}
      </section>
      <LowAttendanceTable
        students={data.lowAttendanceStudents}
        threshold={data.lowAttendanceThreshold}
      />
    </>
  );
}
