import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  Search,
  SlidersHorizontal,
  UserRoundX,
  Users,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageHeader,
  Pagination,
  ProgressBar,
  TableShell,
} from "../components";
import { initials, percentage } from "../utils";

export default function StudentsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [semester, setSemester] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await api.get("/students", {
          q: search,
          className,
          semester,
          page,
          limit: 12,
        }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [search, className, semester, page]);
  useEffect(() => {
    load();
  }, [load]);
  async function deactivate(student) {
    if (
      !window.confirm(
        `Deactivate ${student.fullName}? Their sign-in will be disabled and attendance history retained.`,
      )
    )
      return;
    try {
      await api.delete(`/students/${student.id}`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CAMPUS DIRECTORY"
        title="Students"
        description="Find, review, and manage student records across your classes."
        action={
          user.role === "ADMIN" ? (
            <Link to="/students/new" className="button button-primary">
              <Plus size={17} /> Add student
            </Link>
          ) : null
        }
      />
      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <div className="search-control">
            <Search size={17} />
            <input
              aria-label="Search students"
              placeholder="Search name, student ID, roll or enrollment…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <div className="filter-controls">
            <label className="compact-input">
              <SlidersHorizontal size={15} />
              <input
                aria-label="Filter by class"
                placeholder="Class"
                value={className}
                onChange={(event) => {
                  setClassName(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="compact-select">
              <select
                aria-label="Filter by semester"
                value={semester}
                onChange={(event) => {
                  setSemester(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All semesters</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Semester {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {error && (
          <div className="panel-inset">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        )}
        {loading && !result ? (
          <LoadingState label="Loading student records…" />
        ) : result?.students.length ? (
          <>
            <TableShell>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th>Attendance</th>
                  <th>Enrolled</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar avatar-table">
                          {initials(student.fullName)}
                        </span>
                        <span>
                          <strong>{student.fullName}</strong>
                          <small>
                            Roll {student.rollNumber} · {student.email}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="mono-text">{student.studentId}</span>
                    </td>
                    <td>
                      {student.className}
                      <small className="table-subline">
                        Semester {student.semester}
                      </small>
                    </td>
                    <td>
                      <div className="attendance-cell">
                        <strong
                          className={
                            Number(student.attendancePercentage) <
                            result.lowAttendanceThreshold
                              ? "low-percent"
                              : ""
                          }
                        >
                          {percentage(student.attendancePercentage)}
                        </strong>
                        <ProgressBar
                          value={student.attendancePercentage}
                          threshold={result.lowAttendanceThreshold}
                        />
                      </div>
                    </td>
                    <td>
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(student.createdAt))}
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          className="table-link"
                          to={`/students/${student.id}`}
                        >
                          View <ArrowRight size={14} />
                        </Link>
                        {user.role === "ADMIN" && (
                          <button
                            className="icon-button icon-danger"
                            aria-label={`Deactivate ${student.fullName}`}
                            title="Deactivate student"
                            onClick={() => deactivate(student)}
                          >
                            <UserRoundX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="table-footer">
              <Pagination
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                total={result.pagination.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title={search ? "No students found" : "No student records"}
            description={
              search
                ? "Try another name, roll number, or student ID."
                : "Student records will appear once they are added to the directory."
            }
            icon={Users}
            action={
              user.role === "ADMIN" ? (
                <Link to="/students/new" className="button button-secondary">
                  <Plus size={16} /> Add first student
                </Link>
              ) : null
            }
          />
        )}
        {loading && result && (
          <div className="table-refresh-note">Updating results…</div>
        )}
      </section>
    </>
  );
}
