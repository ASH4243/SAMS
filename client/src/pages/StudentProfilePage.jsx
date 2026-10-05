import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Camera, Edit3, FileClock } from "lucide-react";
import { api, photoUrl } from "../api";
import { useAuth } from "../auth";
import {
  EmptyState,
  ErrorMessage,
  LoadingState,
  PageHeader,
  ProgressBar,
  TableShell,
} from "../components";
import { initials, percentage } from "../utils";

export default function StudentProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileResult, summaryResult] = await Promise.all([
        api.get(`/students/${id}`),
        api.get("/attendance/summary", { studentId: id }),
      ]);
      setStudent(profileResult.student);
      setSummary(summaryResult);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError("Photo must be 4 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      await api.upload(`/students/${id}/photo`, file);
      setPhotoVersion(Date.now());
      await load();
    } catch (requestError) {
      setPhotoError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading && !student)
    return <LoadingState label="Loading student profile…" />;
  if (error && !student)
    return (
      <>
        <ErrorMessage message={error} onRetry={load} />
        <Link to="/students" className="back-link">
          <ArrowLeft size={16} /> Back
        </Link>
      </>
    );
  const isOwn = user.role === "STUDENT";
  const threshold = Number(summary?.lowAttendanceThreshold ?? 0);
  return (
    <>
      {!isOwn && (
        <Link to="/students" className="back-link">
          <ArrowLeft size={16} /> Back to students
        </Link>
      )}
      <PageHeader
        eyebrow="STUDENT PROFILE"
        title={student.fullName}
        description={`${student.className} · Semester ${student.semester} · Student record`}
        action={
          user.role === "ADMIN" ? (
            <Link
              to={`/students/${id}/edit`}
              className="button button-secondary"
            >
              <Edit3 size={15} /> Edit record
            </Link>
          ) : null
        }
      />
      {error && <ErrorMessage message={error} onRetry={load} />}
      <section className="profile-banner panel">
        <div className="profile-banner-person">
          <div className="profile-photo-wrap">
            {student.profilePhoto ? (
              <img
                src={`${photoUrl(id)}?v=${photoVersion}`}
                alt={`${student.fullName}'s profile`}
              />
            ) : (
              <span className="avatar avatar-profile-photo">
                {initials(student.fullName)}
              </span>
            )}
            <span className="photo-status">
              <span />
            </span>
          </div>
          <div className="profile-banner-copy">
            <span className="eyebrow">STUDENT · {student.studentId}</span>
            <h2>{student.fullName}</h2>
            <p>
              {student.className} <span>·</span> Semester {student.semester}{" "}
              <span>·</span> Roll {student.rollNumber}
            </p>
            {photoError && (
              <div className="field-error photo-error">{photoError}</div>
            )}
            {summary && (
              <div className="profile-highlights">
                <span>
                  {percentage(summary.overall.attendancePercentage)} overall
                  attendance
                </span>
                <span>{summary.overall.total} recorded class sessions</span>
              </div>
            )}
          </div>
        </div>
        <div className="profile-actions">
          <label
            className={`button button-secondary upload-button ${uploading ? "disabled" : ""}`}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              disabled={uploading}
            />
            <Camera size={16} />
            {uploading
              ? "Uploading…"
              : student.profilePhoto
                ? "Change photo"
                : "Add photo"}
          </label>
          <small>JPG, PNG or WebP · max 4 MB</small>
        </div>
      </section>
      <div className="profile-content-grid">
        <section className="panel profile-details-panel">
          <div className="panel-heading">
            <div>
              <h2>Personal details</h2>
              <p>Student identity and enrollment</p>
            </div>
          </div>
          <div className="detail-grid">
            {[
              ["Student ID", student.studentId],
              ["Unique ID", student.uniqueId],
              ["Roll number", student.rollNumber],
              ["Enrollment number", student.enrollmentNumber],
              ["Parent / guardian", student.parentsName || "Not provided"],
              ["Blood group", student.bloodGroup || "Not provided"],
              ["Class", student.className],
              ["Semester", student.semester],
            ].map(([label, value]) => (
              <div className="detail-item" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel profile-attendance-card">
          <div className="panel-heading">
            <div>
              <h2>Attendance overview</h2>
              <p>Across all recorded sessions</p>
            </div>
            <FileClock size={17} className="panel-heading-icon" />
          </div>
          <div className="profile-attendance-metric">
            <strong>{percentage(summary?.overall.attendancePercentage)}</strong>
            <span>overall attendance</span>
          </div>
          <ProgressBar
            value={summary?.overall.attendancePercentage}
            threshold={threshold}
          />
          <div className="profile-attendance-counts">
            <span>
              <strong>{summary?.overall.present || 0}</strong> present
            </span>
            <span>
              <strong>{summary?.overall.absent || 0}</strong> absent
            </span>
          </div>
          <Link
            className="full-history-link"
            to={`/attendance/history?studentId=${student.id}`}
          >
            View attendance history <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="panel profile-subject-panel">
        <div className="panel-heading">
          <div>
            <h2>Subject attendance</h2>
            <p>Attendance by subject · low-attendance threshold {threshold}%</p>
          </div>
        </div>
        {summary?.subjects.length ? (
          <TableShell>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Total classes</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {summary.subjects.map((subject) => (
                <tr key={subject.subjectId}>
                  <td>
                    <div>
                      <strong>{subject.subjectName}</strong>
                      <small className="table-subline">
                        {subject.subjectCode}
                      </small>
                    </div>
                  </td>
                  <td>{subject.total}</td>
                  <td>{subject.present}</td>
                  <td>{subject.absent}</td>
                  <td>
                    <div className="attendance-cell">
                      <strong
                        className={
                          Number(subject.attendancePercentage) < threshold
                            ? "low-percent"
                            : ""
                        }
                      >
                        {percentage(subject.attendancePercentage)}
                      </strong>
                      <ProgressBar
                        value={subject.attendancePercentage}
                        threshold={threshold}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState
            title="No subject attendance yet"
            description="Attendance summaries will appear as class records are added."
            icon={FileClock}
          />
        )}
      </section>
    </>
  );
}
