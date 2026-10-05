import { useEffect, useState } from "react";
import { AlertCircle, Check, Save, SlidersHorizontal } from "lucide-react";
import { api } from "../api";
import { ErrorMessage, Field, LoadingState, PageHeader } from "../components";

export default function SettingsPage() {
  const [threshold, setThreshold] = useState("75");
  const [savedThreshold, setSavedThreshold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api
      .get("/settings")
      .then((result) => {
        setThreshold(String(result.lowAttendanceThreshold));
        setSavedThreshold(result.lowAttendanceThreshold);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);
  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await api.patch("/settings", {
        lowAttendanceThreshold: Number(threshold),
      });
      setThreshold(String(result.lowAttendanceThreshold));
      setSavedThreshold(result.lowAttendanceThreshold);
      setNotice(
        "Attendance threshold updated. Dashboard alerts now use this value.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <LoadingState label="Loading system settings…" />;
  return (
    <>
      <PageHeader
        eyebrow="SYSTEM CONFIGURATION"
        title="Settings"
        description="Set campus-wide attendance rules and review security details."
      />
      {error && <ErrorMessage message={error} />}
      {notice && (
        <div className="notice notice-success">
          <Check size={17} />
          <span>{notice}</span>
        </div>
      )}
      <section className="panel settings-card">
        <div className="settings-card-icon">
          <SlidersHorizontal size={20} />
        </div>
        <div className="settings-card-content">
          <span className="eyebrow">ATTENDANCE POLICY</span>
          <h2>Low attendance threshold</h2>
          <p>
            Students below this percentage are highlighted on administrator and
            teacher dashboards, and marked in attendance summaries.
          </p>
          <form className="settings-form" onSubmit={save}>
            <Field
              label="Minimum attendance percentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              required
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              hint="Enter a value from 0 to 100. The default for a new database is 75%."
            />
            <div className="settings-form-bottom">
              <span>
                <AlertCircle size={15} /> Changes apply to future dashboard
                views.
              </span>
              <button
                className="button button-primary"
                disabled={
                  saving || Number(threshold) === Number(savedThreshold)
                }
              >
                {saving ? (
                  <>
                    <span className="button-spinner" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save settings
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
      <section className="panel settings-info">
        <div>
          <span className="eyebrow">SECURITY</span>
          <h2>Access and data handling</h2>
          <p>
            Roles and permissions are checked by the server for every protected
            API request. Attendance history is retained when a student, teacher,
            or subject is deactivated.
          </p>
        </div>
        <div className="security-badge">
          <span /> Role-based access active
        </div>
      </section>
    </>
  );
}
