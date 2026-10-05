import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardCheck,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { api } from "../api";
import {
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageHeader,
  StatusBadge,
  TableShell,
} from "../components";
import { initials, today } from "../utils";

export default function AttendanceMarkPage() {
  const [searchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState(
    searchParams.get("subjectId") || "",
  );
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [q, setQ] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api
      .get("/subjects", { limit: 100 })
      .then((result) => setSubjects(result.subjects))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoadingSubjects(false));
  }, []);
  const loadRoster = useCallback(async () => {
    if (!subjectId || !date) {
      setRoster([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.get("/attendance/roster", { subjectId, date });
      setRoster(result.students);
      setStatuses(
        Object.fromEntries(
          result.students.map((student) => [student.id, student.status || ""]),
        ),
      );
    } catch (requestError) {
      setError(requestError.message);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, date]);
  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const visibleRoster = useMemo(
    () =>
      roster.filter((student) =>
        `${student.fullName} ${student.studentId} ${student.rollNumber}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [roster, q],
  );
  const markedCount = Object.values(statuses).filter(Boolean).length;
  function markAll(status) {
    setStatuses(
      Object.fromEntries(roster.map((student) => [student.id, status])),
    );
  }
  async function save() {
    if (!subjectId || !roster.length) return;
    if (markedCount !== roster.length) {
      setError(
        `Mark every student before saving (${roster.length - markedCount} remaining).`,
      );
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post("/attendance", {
        subjectId: Number(subjectId),
        attendanceDate: date,
        records: roster.map((student) => ({
          studentId: student.id,
          status: statuses[student.id],
        })),
      });
      setNotice(
        `${result.saved} attendance ${result.saved === 1 ? "record" : "records"} saved. Existing records for this date were updated where applicable.`,
      );
      await loadRoster();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  const selectedSubject = subjects.find(
    (subject) => String(subject.id) === String(subjectId),
  );

  return (
    <>
      <PageHeader
        eyebrow="CLASSROOM TOOLS"
        title="Mark attendance"
        description="Choose a subject and date, then record each student's status."
      />
      {error && (
        <ErrorMessage
          message={error}
          onRetry={subjectId ? loadRoster : undefined}
        />
      )}
      {notice && (
        <div className="notice notice-success">
          <Check size={17} />
          <span>{notice}</span>
          <button
            className="notice-dismiss"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <section className="panel attendance-control-panel">
        <div className="attendance-control-heading">
          <span className="control-icon">
            <ClipboardCheck size={19} />
          </span>
          <div>
            <h2>Attendance session</h2>
            <p>Class roster is based on the selected subject.</p>
          </div>
        </div>
        <div className="attendance-select-grid">
          <label className="form-field">
            <span>Subject</span>
            <select
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setNotice("");
              }}
              disabled={loadingSubjects}
              required
            >
              <option value="">
                {loadingSubjects ? "Loading subjects…" : "Select a subject"}
              </option>
              {subjects.map((subject) => (
                <option value={subject.id} key={subject.id}>
                  {subject.subjectCode} — {subject.subjectName} ·{" "}
                  {subject.className} S{subject.semester}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Class date</span>
            <span className="date-input-wrap">
              <CalendarDays size={16} />
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setNotice("");
                }}
                max={today()}
                required
              />
            </span>
          </label>
          {selectedSubject && (
            <div className="session-summary">
              <span className="eyebrow">SELECTED CLASS</span>
              <strong>
                {selectedSubject.className} · Semester{" "}
                {selectedSubject.semester}
              </strong>
              <small>{selectedSubject.subjectName}</small>
            </div>
          )}
        </div>
      </section>
      {subjectId && (
        <section className="panel roster-panel">
          <div className="roster-toolbar">
            <div>
              <div className="eyebrow">CLASS ROSTER</div>
              <h2>{selectedSubject?.subjectName || "Students"}</h2>
              <p>
                {roster.length} enrolled · {markedCount} of {roster.length}{" "}
                marked
              </p>
            </div>
            <div className="roster-actions">
              <button
                className="button button-quiet button-present"
                onClick={() => markAll("PRESENT")}
                disabled={!roster.length}
              >
                <UserCheck size={16} /> All present
              </button>
              <button
                className="button button-quiet button-absent"
                onClick={() => markAll("ABSENT")}
                disabled={!roster.length}
              >
                <UserX size={16} /> All absent
              </button>
              <button
                className="button button-primary"
                onClick={save}
                disabled={
                  saving ||
                  loading ||
                  !roster.length ||
                  markedCount !== roster.length
                }
              >
                {saving ? (
                  <>
                    <span className="button-spinner" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCheck size={16} /> Save attendance
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="roster-search">
            <Search size={16} />
            <input
              aria-label="Filter roster"
              placeholder="Filter this roster by name, ID, or roll number…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          {loading ? (
            <LoadingState label="Loading class roster…" />
          ) : roster.length ? (
            visibleRoster.length ? (
              <TableShell>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Student ID</th>
                    <th>Roll no.</th>
                    <th>Current status</th>
                    <th>Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRoster.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="table-person">
                          <span className="avatar avatar-table">
                            {initials(student.fullName)}
                          </span>
                          <span>
                            <strong>{student.fullName}</strong>
                            <small>Enrolled student</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="mono-text">{student.studentId}</span>
                      </td>
                      <td>{student.rollNumber}</td>
                      <td>
                        <StatusBadge status={statuses[student.id]} />
                      </td>
                      <td>
                        <div
                          className="mark-toggle"
                          role="group"
                          aria-label={`Mark attendance for ${student.fullName}`}
                        >
                          <button
                            type="button"
                            className={
                              statuses[student.id] === "PRESENT"
                                ? "mark-option selected present"
                                : "mark-option"
                            }
                            onClick={() =>
                              setStatuses((old) => ({
                                ...old,
                                [student.id]: "PRESENT",
                              }))
                            }
                            aria-pressed={statuses[student.id] === "PRESENT"}
                          >
                            <Check size={15} />
                            <span>Present</span>
                          </button>
                          <button
                            type="button"
                            className={
                              statuses[student.id] === "ABSENT"
                                ? "mark-option selected absent"
                                : "mark-option"
                            }
                            onClick={() =>
                              setStatuses((old) => ({
                                ...old,
                                [student.id]: "ABSENT",
                              }))
                            }
                            aria-pressed={statuses[student.id] === "ABSENT"}
                          >
                            <UserX size={15} />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            ) : (
              <EmptyState
                title="No matching students"
                description="Try another name or roll number."
                icon={Search}
              />
            )
          ) : (
            <EmptyState
              title="No students in this class"
              description="This subject's class and semester have no active student records."
              icon={ClipboardCheck}
            />
          )}
          {!!roster.length && (
            <div className="roster-footer">
              <span>
                <span
                  className={
                    markedCount === roster.length
                      ? "completion-dot complete"
                      : "completion-dot"
                  }
                />{" "}
                {markedCount === roster.length
                  ? "Ready to save"
                  : `${roster.length - markedCount} students still need a status`}
              </span>
              <button
                className="button button-primary"
                onClick={save}
                disabled={saving || loading || markedCount !== roster.length}
              >
                {saving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
