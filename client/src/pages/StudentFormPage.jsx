import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Save } from "lucide-react";
import { api } from "../api";
import { ErrorMessage, Field, LoadingState, PageHeader } from "../components";

const emptyForm = {
  email: "",
  password: "",
  studentId: "",
  uniqueId: "",
  rollNumber: "",
  enrollmentNumber: "",
  fullName: "",
  parentsName: "",
  bloodGroup: "",
  className: "",
  semester: "1",
};

export default function StudentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    api
      .get(`/students/${id}`)
      .then(({ student }) => {
        if (cancelled) return;
        setForm({
          email: student.email,
          studentId: student.studentId,
          uniqueId: student.uniqueId,
          rollNumber: student.rollNumber,
          enrollmentNumber: student.enrollmentNumber,
          fullName: student.fullName,
          parentsName: student.parentsName || "",
          bloodGroup: student.bloodGroup || "",
          className: student.className,
          semester: String(student.semester),
        });
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, id]);

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const body = {
      ...form,
      semester: Number(form.semester),
      parentsName: form.parentsName || null,
      bloodGroup: form.bloodGroup || null,
    };
    try {
      if (editing) {
        delete body.password;
        await api.put(`/students/${id}`, body);
        setSuccess("Student record saved.");
      } else {
        await api.post("/students", body);
        setSuccess("Student account created.");
      }
      window.setTimeout(() => navigate("/students"), 650);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading student record…" />;
  return (
    <>
      <Link to="/students" className="back-link">
        <ArrowLeft size={16} /> Back to students
      </Link>
      <PageHeader
        eyebrow={editing ? "STUDENT RECORD" : "NEW RECORD"}
        title={editing ? "Edit student" : "Add a student"}
        description={
          editing
            ? "Update the student details and account email."
            : "Create a student profile and sign-in account."
        }
      />
      {error && <ErrorMessage message={error} />}
      {success && (
        <div className="notice notice-success">
          <Check size={17} />
          {success}
        </div>
      )}
      <form className="panel student-form-panel" onSubmit={submit}>
        <div className="form-section-heading">
          <span className="form-step">01</span>
          <div>
            <h2>Student identity</h2>
            <p>Core details used to identify the student in class.</p>
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Full name"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={update("fullName")}
            placeholder="e.g. Jordan Lee"
          />
          <Field
            label="Student ID"
            required
            value={form.studentId}
            onChange={update("studentId")}
            placeholder="e.g. STU-2025-0042"
          />
          <Field
            label="Unique ID"
            required
            value={form.uniqueId}
            onChange={update("uniqueId")}
            placeholder="Institutional identifier"
          />
          <Field
            label="Roll number"
            required
            value={form.rollNumber}
            onChange={update("rollNumber")}
            placeholder="e.g. 042"
          />
          <Field
            label="Enrollment number"
            required
            value={form.enrollmentNumber}
            onChange={update("enrollmentNumber")}
            placeholder="e.g. ENR-2025-0042"
          />
          <Field
            label="Parent / guardian name"
            value={form.parentsName}
            onChange={update("parentsName")}
            placeholder="Optional"
          />
          <Field
            label="Blood group"
            as="select"
            value={form.bloodGroup}
            onChange={update("bloodGroup")}
          >
            <option value="">Not provided</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Field>
          <Field
            label="Class"
            required
            value={form.className}
            onChange={update("className")}
            placeholder="e.g. BCA"
          />
          <Field
            label="Semester"
            as="select"
            required
            value={form.semester}
            onChange={update("semester")}
          >
            <option value="">Select semester</option>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                Semester {index + 1}
              </option>
            ))}
          </Field>
        </div>
        <div className="form-section-heading form-section-spaced">
          <span className="form-step">02</span>
          <div>
            <h2>Sign-in account</h2>
            <p>Students use this email to access their own attendance.</p>
          </div>
        </div>
        <div className="form-grid form-grid-account">
          <Field
            label="Campus email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update("email")}
            placeholder="student@campus.edu"
          />
          {!editing && (
            <Field
              label="Temporary password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.password}
              onChange={update("password")}
              placeholder="At least 8 characters"
              hint="Share the initial password securely with the student."
            />
          )}
        </div>
        <div className="form-actions">
          <Link to="/students" className="button button-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="button-spinner" /> Saving…
              </>
            ) : (
              <>
                <Save size={16} /> {editing ? "Save changes" : "Create student"}
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
