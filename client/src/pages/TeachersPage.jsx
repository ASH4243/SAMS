import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  UserRoundX,
} from "lucide-react";
import { api } from "../api";
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
import { initials } from "../utils";

const blank = { email: "", employeeId: "", fullName: "", password: "" };

export default function TeachersPage() {
  const [result, setResult] = useState(null);
  const [q, setQ] = useState("");
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
      setResult(await api.get("/teachers", { q, page, limit: 12 }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [q, page]);
  useEffect(() => {
    load();
  }, [load]);
  function openCreate() {
    setEditing(null);
    setForm(blank);
    setError("");
    setModal(true);
  }
  function openEdit(teacher) {
    setEditing(teacher);
    setForm({
      email: teacher.email,
      employeeId: teacher.employeeId,
      fullName: teacher.fullName,
      password: "",
    });
    setError("");
    setModal(true);
  }
  const set = (key) => (event) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing)
        await api.put(`/teachers/${editing.id}`, {
          email: form.email,
          employeeId: form.employeeId,
          fullName: form.fullName,
        });
      else await api.post("/teachers", form);
      setModal(false);
      setNotice(
        editing ? "Teacher details updated." : "Teacher account created.",
      );
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function deactivate(teacher) {
    if (
      !window.confirm(
        `Deactivate ${teacher.fullName}? Their sign-in will be disabled and assigned subjects will be unassigned.`,
      )
    )
      return;
    try {
      await api.delete(`/teachers/${teacher.id}`);
      setNotice("Teacher deactivated.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & PERMISSIONS"
        title="Teaching staff"
        description="Manage teacher accounts and their classroom access."
        action={
          <button className="button button-primary" onClick={openCreate}>
            <Plus size={17} /> Add teacher
          </button>
        }
      />
      {notice && (
        <div className="notice notice-success">
          <GraduationCap size={17} />
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
              aria-label="Search teachers"
              placeholder="Search by name, employee ID or email…"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="directory-total">
            {result?.pagination.total ?? "—"} active teachers
          </span>
        </div>
        {error && (
          <div className="panel-inset">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        )}
        {loading && !result ? (
          <LoadingState label="Loading teacher accounts…" />
        ) : result?.teachers.length ? (
          <>
            <TableShell>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Employee ID</th>
                  <th>Assigned subjects</th>
                  <th>Account email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar avatar-table avatar-violet">
                          {initials(teacher.fullName)}
                        </span>
                        <span>
                          <strong>{teacher.fullName}</strong>
                          <small>Teaching staff</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="mono-text">{teacher.employeeId}</span>
                    </td>
                    <td>
                      <span className="table-pill">
                        {teacher.subjectCount} subjects
                      </span>
                    </td>
                    <td>{teacher.email}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${teacher.fullName}`}
                          onClick={() => openEdit(teacher)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button icon-danger"
                          aria-label={`Deactivate ${teacher.fullName}`}
                          onClick={() => deactivate(teacher)}
                        >
                          <UserRoundX size={15} />
                        </button>
                      </div>
                    </td>
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
            title={q ? "No matching teachers" : "No teachers yet"}
            description={
              q
                ? "Try a different name, ID, or email."
                : "Create a teacher account to assign subjects and manage attendance."
            }
            icon={GraduationCap}
            action={
              !q && (
                <button
                  className="button button-secondary"
                  onClick={openCreate}
                >
                  <Plus size={16} /> Add teacher
                </button>
              )
            }
          />
        )}
      </section>
      {modal && (
        <Modal
          title={editing ? "Edit teacher" : "Create teacher account"}
          onClose={() => setModal(false)}
        >
          <form onSubmit={submit} className="modal-form">
            {error && <ErrorMessage message={error} />}
            <Field
              label="Full name"
              required
              value={form.fullName}
              onChange={set("fullName")}
              placeholder="Teacher name"
            />
            <Field
              label="Employee ID"
              required
              value={form.employeeId}
              onChange={set("employeeId")}
              placeholder="e.g. EMP-1004"
            />
            <Field
              label="Campus email"
              type="email"
              required
              value={form.email}
              onChange={set("email")}
              placeholder="teacher@campus.edu"
            />
            {!editing && (
              <Field
                label="Temporary password"
                type="password"
                minLength={8}
                required
                value={form.password}
                onChange={set("password")}
                placeholder="At least 8 characters"
              />
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create account"}{" "}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
