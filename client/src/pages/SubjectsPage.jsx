import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  UserRoundX,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorMessage,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  TableShell,
} from "../components";

const blank = {
  subjectCode: "",
  subjectName: "",
  className: "",
  semester: "1",
  teacherId: "",
};

export default function SubjectsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "ADMIN";
  const [result, setResult] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [q, setQ] = useState("");
  const [className, setClassName] = useState("");
  const [semester, setSemester] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setResult(
        await api.get("/subjects", { q, className, semester, page, limit: 12 }),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [q, className, semester, page]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (isAdmin)
      api
        .get("/teachers", { limit: 100 })
        .then((value) => setTeachers(value.teachers))
        .catch(() => {});
  }, [isAdmin]);
  const set = (key) => (event) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));
  function create() {
    setEditing(null);
    setForm(blank);
    setError("");
    setModal(true);
  }
  function edit(subject) {
    setEditing(subject);
    setForm({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      className: subject.className,
      semester: String(subject.semester),
      teacherId: subject.teacherId || "",
    });
    setError("");
    setModal(true);
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...form,
      semester: Number(form.semester),
      teacherId: form.teacherId ? Number(form.teacherId) : null,
    };
    try {
      if (editing) await api.put(`/subjects/${editing.id}`, body);
      else await api.post("/subjects", body);
      setModal(false);
      setNotice(editing ? "Subject updated." : "Subject added.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function deactivate(subject) {
    if (
      !window.confirm(
        `Deactivate ${subject.subjectName}? Existing attendance history will be retained.`,
      )
    )
      return;
    try {
      await api.delete(`/subjects/${subject.id}`);
      setNotice("Subject deactivated.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="ACADEMIC CATALOG"
        title="Subjects"
        description={
          isAdmin
            ? "Manage subject details, class assignments, and teaching staff."
            : "Browse subjects available to your account."
        }
        action={
          isAdmin && (
            <button className="button button-primary" onClick={create}>
              <Plus size={17} /> Add subject
            </button>
          )
        }
      />
      {notice && (
        <div className="notice notice-success">
          <BookOpen size={17} />
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
      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <div className="search-control">
            <Search size={17} />
            <input
              aria-label="Search subjects"
              placeholder="Search subject name or code…"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-controls">
            <label className="compact-input">
              <CalendarDays size={15} />
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
          <LoadingState label="Loading subjects…" />
        ) : result?.subjects.length ? (
          <>
            <TableShell>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Semester</th>
                  <th>Teacher</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td>
                      <div className="subject-table-name">
                        <span className="subject-icon">
                          <BookOpen size={17} />
                        </span>
                        <span>
                          <strong>{subject.subjectName}</strong>
                          <small>{subject.subjectCode}</small>
                        </span>
                      </div>
                    </td>
                    <td>{subject.className}</td>
                    <td>
                      <span className="table-pill">
                        Semester {subject.semester}
                      </span>
                    </td>
                    <td>
                      {subject.teacherName || (
                        <span className="muted-text">Unassigned</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-button"
                            aria-label={`Edit ${subject.subjectName}`}
                            onClick={() => edit(subject)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button icon-danger"
                            aria-label={`Deactivate ${subject.subjectName}`}
                            onClick={() => deactivate(subject)}
                          >
                            <UserRoundX size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="table-footer">
              <Pagination
                page={page}
                totalPages={result.pagination.totalPages}
                total={result.pagination.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title={
              q || className || semester
                ? "No matching subjects"
                : "No subjects yet"
            }
            description={
              isAdmin
                ? "Add subjects to make them available for attendance marking."
                : "Subjects assigned to your class or account will appear here."
            }
            icon={BookOpen}
            action={
              isAdmin && (
                <button className="button button-secondary" onClick={create}>
                  <Plus size={16} /> Add subject
                </button>
              )
            }
          />
        )}
      </section>
      {modal && (
        <Modal
          title={editing ? "Edit subject" : "Add subject"}
          onClose={() => setModal(false)}
        >
          <form className="modal-form" onSubmit={submit}>
            {error && <ErrorMessage message={error} />}
            <Field
              label="Subject name"
              required
              value={form.subjectName}
              onChange={set("subjectName")}
              placeholder="e.g. Database Management Systems"
            />
            <div className="form-grid">
              <Field
                label="Subject code"
                required
                value={form.subjectCode}
                onChange={set("subjectCode")}
                placeholder="BCA501"
              />
              <Field
                label="Class"
                required
                value={form.className}
                onChange={set("className")}
                placeholder="BCA"
              />
              <Field
                label="Semester"
                as="select"
                required
                value={form.semester}
                onChange={set("semester")}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Semester {index + 1}
                  </option>
                ))}
              </Field>
              <Field
                label="Assigned teacher"
                as="select"
                value={form.teacherId}
                onChange={set("teacherId")}
              >
                <option value="">Unassigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName} · {teacher.employeeId}
                  </option>
                ))}
              </Field>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add subject"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
