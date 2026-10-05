import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Check, UserRound } from "lucide-react";
import { api, photoUrl } from "../api";
import { useAuth } from "../auth";
import { ErrorMessage, PageHeader } from "../components";
import { initials, titleCase } from "../utils";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const profile = user?.profile;
  const isStudent = user?.role === "STUDENT" && Boolean(profile?.id);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be 4 MB or smaller.");
      return;
    }
    setSavingPhoto(true);
    try {
      await api.upload(`/students/${profile.id}/photo`, file);
      await refresh();
      setPhotoVersion(Date.now());
      setNotice("Profile photo updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNT"
        title="My profile"
        description="Your sign-in identity and role-specific account details."
        action={
          isStudent && (
            <Link
              to={`/students/${profile.id}`}
              className="button button-secondary"
            >
              Full student profile
            </Link>
          )
        }
      />
      {error && <ErrorMessage message={error} />}
      {notice && (
        <div className="notice notice-success">
          <Check size={17} />
          <span>{notice}</span>
        </div>
      )}
      <section className="profile-summary-card account-card">
        {isStudent && profile.profilePhoto ? (
          <img
            className="avatar avatar-profile account-photo"
            src={`${photoUrl(profile.id)}?v=${photoVersion}`}
            alt={`${profile.fullName}'s profile`}
          />
        ) : (
          <div className="avatar avatar-profile">
            {initials(profile?.fullName || user?.email)}
          </div>
        )}
        <div className="profile-summary-main">
          <span className="eyebrow">{titleCase(user?.role)}</span>
          <h2>{profile?.fullName || "Administrator"}</h2>
          <p>{user?.email}</p>
        </div>
        <span className="account-status">
          <span /> Active account
        </span>
      </section>
      {isStudent && (
        <section className="panel profile-photo-settings">
          <div className="settings-card-icon">
            <Camera size={19} />
          </div>
          <div>
            <h2>Profile photo</h2>
            <p>
              Keep your student profile up to date with a clear, recent photo.
            </p>
          </div>
          <label
            className={`button button-secondary upload-button ${savingPhoto ? "disabled" : ""}`}
          >
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={uploadPhoto}
              disabled={savingPhoto}
            />
            <Camera size={15} />
            {savingPhoto ? "Uploading…" : "Change photo"}
          </label>
        </section>
      )}
      {profile && (
        <section className="panel account-details">
          <div className="panel-heading">
            <div>
              <h2>{isStudent ? "Enrollment details" : "Account details"}</h2>
              <p>
                {isStudent
                  ? "Information linked to your attendance records."
                  : "Information associated with your campus account."}
              </p>
            </div>
            <UserRound size={17} className="panel-heading-icon" />
          </div>
          <div className="detail-grid">
            {Object.entries({
              "Student ID": profile.studentId,
              "Unique ID": profile.uniqueId,
              "Roll number": profile.rollNumber,
              "Enrollment number": profile.enrollmentNumber,
              "Parent / guardian": profile.parentsName,
              "Blood group": profile.bloodGroup,
              Class: profile.className,
              Semester: profile.semester,
              "Employee ID": profile.employeeId,
            })
              .filter(([, value]) => value != null)
              .map(([label, value]) => (
                <div className="detail-item" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
          </div>
        </section>
      )}
      <div className="notice notice-neutral">
        <span className="notice-dot" />
        <span>
          For account changes or a password reset, contact your system
          administrator.
        </span>
      </div>
    </>
  );
}
