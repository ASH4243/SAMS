import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email, password });
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-intro">
        <div className="login-brand">
          <span className="brand-mark">
            <Activity size={20} />
          </span>
          <strong>Northstar</strong>
        </div>
        <div className="intro-content">
          <span className="intro-kicker">
            <span /> CAMPUS ATTENDANCE, REIMAGINED
          </span>
          <h1>
            Every day
            <br />
            counts<span>.</span>
          </h1>
          <p>
            A clearer picture of student engagement. One secure place for
            attendance, insights, and the people behind every class.
          </p>
          <div className="intro-feature">
            <span>
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Built around trust</strong>
              <small>Private student records. Role-aware access.</small>
            </div>
          </div>
        </div>
        <div className="intro-footer">
          <span>SMART STUDENT ATTENDANCE</span>
          <span>01 — 04</span>
        </div>
        <div className="intro-orbit orbit-one" />
        <div className="intro-orbit orbit-two" />
        <div className="intro-glow" />
      </section>
      <section className="login-panel">
        <div className="login-panel-top">
          <span className="mobile-login-brand">
            <Activity size={18} /> NORTHSTAR
          </span>
          <span className="secure-note">
            <LockKeyhole size={14} /> Secure sign in
          </span>
        </div>
        <div className="login-box">
          <div className="login-heading">
            <div className="login-icon">
              <LockKeyhole size={19} />
            </div>
            <span className="eyebrow">WELCOME BACK</span>
            <h2>
              Sign in to your
              <br />
              workspace
            </h2>
            <p>Use your campus account to continue.</p>
          </div>
          <form onSubmit={submit} className="login-form">
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <label className="login-field">
              <span>Email address</span>
              <span className="input-with-icon">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@campus.edu"
                />
              </span>
            </label>
            <label className="login-field">
              <span>Password</span>
              <span className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? "Hide password" : "Show password"}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="button-spinner" /> Signing in…
                </>
              ) : (
                <>
                  Continue <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="login-assurance">
            <ShieldCheck size={15} />
            <span>Your session is protected with secure authentication.</span>
          </div>
        </div>
        <p className="login-legal">
          By continuing, you agree to follow your institution's data and privacy
          policies.
        </p>
      </section>
    </main>
  );
}
