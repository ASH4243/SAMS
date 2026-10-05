import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "./auth";
import { initials, titleCase } from "./utils";

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = user?.role;
  const nav = [
    {
      to: "/",
      label: "Overview",
      icon: LayoutDashboard,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
      end: true,
    },
    {
      to: "/students",
      label: "Students",
      icon: Users,
      roles: ["ADMIN", "TEACHER"],
    },
    {
      to: "/profile",
      label: "My profile",
      icon: UserRound,
      roles: ["STUDENT"],
    },
    {
      to: "/teachers",
      label: "Teachers",
      icon: GraduationCap,
      roles: ["ADMIN"],
    },
    {
      to: "/subjects",
      label: "Subjects",
      icon: BookOpen,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
    },
    {
      to: "/attendance/mark",
      label: "Mark attendance",
      icon: ClipboardCheck,
      roles: ["ADMIN", "TEACHER"],
    },
    {
      to: "/attendance/history",
      label: "Attendance history",
      icon: CalendarCheck2,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
    },
    { to: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
  ].filter((item) => item.roles.includes(role));
  const displayName =
    user?.profile?.fullName ||
    (role === "ADMIN" ? "Administrator" : user?.email);
  const close = () => setOpen(false);

  async function signOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <Link to="/" className="brand-home" onClick={close}>
            <span className="brand-mark">
              <Activity size={20} strokeWidth={2.4} />
            </span>
            <span className="brand-copy">
              <strong>Northstar</strong>
              <small>ATTENDANCE</small>
            </span>
          </Link>
          <button
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={close}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Mark attendance" && <span className="nav-pulse" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <CircleHelp size={17} />
            </span>
            <div>
              <strong>Need a hand?</strong>
              <span>Talk to your administrator</span>
            </div>
          </div>
          <button className="sidebar-user" onClick={() => navigate("/profile")}>
            <span className="avatar avatar-small">{initials(displayName)}</span>
            <span className="sidebar-user-copy">
              <strong>{displayName}</strong>
              <small>{titleCase(role || "")}</small>
            </span>
            <ChevronRight size={16} className="user-chevron" />
          </button>
          <button className="logout-link" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {useLocation().pathname === "/"
                ? "Overview"
                : documentTitle(useLocation().pathname)}
            </strong>
          </div>
          <div className="topbar-right">
            <div className="secure-indicator">
              <ShieldCheck size={16} />
              <span>Secure workspace</span>
            </div>
            <span className="avatar avatar-top">{initials(displayName)}</span>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function documentTitle(path) {
  if (path === "/students/new") return "Add student";
  if (path.startsWith("/students/"))
    return path.includes("/edit") ? "Edit student" : "Student profile";
  if (path.startsWith("/students")) return "Students";
  if (path.startsWith("/teachers")) return "Teachers";
  if (path.startsWith("/subjects")) return "Subjects";
  if (path.includes("/mark")) return "Mark attendance";
  if (path.includes("/history")) return "Attendance history";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/profile")) return "My profile";
  return "Overview";
}

export function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action || children ? (
        <div className="page-header-action">{action || children}</div>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = "blue",
  trend,
}) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-caption">
        {trend != null && (
          <span
            className={`stat-trend ${Number(trend) >= 0 ? "trend-up" : "trend-down"}`}
          >
            {Number(trend) >= 0 ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {Math.abs(Number(trend))}%
          </span>
        )}
        {caption}
      </div>
    </article>
  );
}

export function LoadingState({ label = "Loading your workspace…" }) {
  return (
    <div className="state-card loading-state">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div role="alert" className="notice notice-error">
      <AlertCircle size={18} />
      <span>{message || "Something went wrong. Please try again."}</span>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description = "When information is available, it will appear here.",
  icon: Icon = Search,
  action,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={21} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange, total }) {
  if (totalPages <= 1)
    return (
      <div className="pagination-caption">
        {total || 0} {total === 1 ? "record" : "records"}
      </div>
    );
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page} of {totalPages}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const normalized = String(status || "NOT MARKED").toUpperCase();
  const className =
    normalized === "PRESENT"
      ? "status-present"
      : normalized === "ABSENT"
        ? "status-absent"
        : "status-pending";
  return (
    <span className={`status-badge ${className}`}>
      <span />
      {normalized === "NOT MARKED" ? "Not marked" : titleCase(normalized)}
    </span>
  );
}

export function TableShell({ children, className = "" }) {
  return (
    <div className={`table-scroll ${className}`}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  className = "",
  as = "input",
  children,
  ...props
}) {
  const control =
    as === "textarea" ? (
      <textarea {...props}>{children}</textarea>
    ) : as === "select" ? (
      <select {...props}>{children}</select>
    ) : (
      <input {...props} />
    );
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ProgressBar({ value, threshold = 0 }) {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-track">
      <span
        style={{ width: `${numeric}%` }}
        className={numeric < Number(threshold) ? "progress-low" : ""}
      />
    </div>
  );
}
