import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, FileClock, Filter, Search } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
  TableShell,
} from "../components";
import { formatDate, initials } from "../utils";

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const pinnedStudentId =
    user.role === "STUDENT"
      ? user.profile?.id
      : searchParams.get("studentId") || "";
  const [subjects, setSubjects] = useState([]);
  const [q, setQ] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [className, setClassName] = useState("");
  const [semester, setSemester] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/subjects", { limit: 100 })
      .then((data) => setSubjects(data.subjects))
      .catch(() => {});
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await api.get("/attendance", {
          q,
          studentId: pinnedStudentId,
          subjectId,
          className,
          semester,
          from,
          to,
          status,
          page,
          limit: 15,
        }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [
    q,
    pinnedStudentId,
    subjectId,
    className,
    semester,
    from,
    to,
    status,
    page,
  ]);
  useEffect(() => {
    load();
  }, [load]);
  const change = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const isStudent = user.role === "STUDENT";

  return (
    <>
      <PageHeader
        eyebrow="RECORDS & INSIGHTS"
        title={isStudent ? "My attendance history" : "Attendance history"}
        description={
          isStudent
            ? "Review your recorded attendance by date and subject."
            : "Search and filter recorded attendance across your authorized classes."
        }
      />
      <section className="panel directory-panel history-panel">
        <div className="directory-toolbar history-filters">
          <div className="search-control">
            <Search size={17} />
            <input
              aria-label="Search attendance history"
              placeholder={
                isStudent
                  ? "Search by subject…"
                  : "Search by student, roll number, or ID…"
              }
              value={q}
              onChange={change(setQ)}
            />
          </div>
          <div className="filter-controls">
            <label className="compact-select">
              <Filter size={15} />
              <select
                aria-label="Filter by subject"
                value={subjectId}
                onChange={change(setSubjectId)}
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subjectCode} · {subject.subjectName}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-select">
              <select
                aria-label="Filter by status"
                value={status}
                onChange={change(setStatus)}
              >
                <option value="">All statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
              </select>
            </label>
            {!isStudent && (
              <>
                <label className="compact-input">
                  <input
                    aria-label="Filter by class"
                    placeholder="Class"
                    value={className}
                    onChange={change(setClassName)}
                  />
                </label>
                <label className="compact-select">
                  <select
                    aria-label="Filter by semester"
                    value={semester}
                    onChange={change(setSemester)}
                  >
                    <option value="">Semester</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
        <div className="date-filter-row">
          <label>
            <CalendarDays size={15} />
            <span>From</span>
            <input type="date" value={from} onChange={change(setFrom)} />
          </label>
          <label>
            <CalendarDays size={15} />
            <span>To</span>
            <input type="date" value={to} onChange={change(setTo)} />
          </label>
          <span className="filter-hint">Date range is inclusive.</span>
          <button
            className="filter-reset"
            onClick={() => {
              setQ("");
              setSubjectId("");
              setClassName("");
              setSemester("");
              setFrom("");
              setTo("");
              setStatus("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
        {error && (
          <div className="panel-inset">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        )}
        {loading && !result ? (
          <LoadingState label="Loading attendance records…" />
        ) : result?.records.length ? (
          <>
            <TableShell>
              <thead>
                <tr>
                  <th>Date</th>
                  {!isStudent && <th>Student</th>}
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Marked by</th>
                </tr>
              </thead>
              <tbody>
                {result.records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="date-cell">
                        {formatDate(record.date)}
                      </span>
                    </td>
                    {!isStudent && (
                      <td>
                        <div className="table-person">
                          <span className="avatar avatar-table">
                            {initials(record.studentName)}
                          </span>
                          <span>
                            <strong>{record.studentName}</strong>
                            <small>
                              {record.studentCode} · Roll {record.rollNumber}
                            </small>
                          </span>
                        </div>
                      </td>
                    )}
                    <td>
                      <div>
                        <strong className="history-subject">
                          {record.subjectName}
                        </strong>
                        <small className="table-subline">
                          {record.subjectCode}
                        </small>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                    <td>{record.markedByName || "Unavailable"}</td>
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
            title="No attendance records found"
            description="Try broadening the date range or clearing one of the selected filters."
            icon={FileClock}
          />
        )}
        {loading && result && (
          <div className="table-refresh-note">Updating results…</div>
        )}
      </section>
    </>
  );
}
