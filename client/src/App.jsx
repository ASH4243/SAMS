import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./components";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import StudentFormPage from "./pages/StudentFormPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import TeachersPage from "./pages/TeachersPage";
import SubjectsPage from "./pages/SubjectsPage";
import AttendanceMarkPage from "./pages/AttendanceMarkPage";
import AttendanceHistoryPage from "./pages/AttendanceHistoryPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

function Protected() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="boot-screen">
        <span className="spinner" />
        <span>Preparing your workspace</span>
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <AppLayout />;
}

function RoleOnly({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<Protected />}>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/students"
          element={
            <RoleOnly roles={["ADMIN", "TEACHER"]}>
              <StudentsPage />
            </RoleOnly>
          }
        />
        <Route
          path="/students/new"
          element={
            <RoleOnly roles={["ADMIN"]}>
              <StudentFormPage />
            </RoleOnly>
          }
        />
        <Route
          path="/students/:id/edit"
          element={
            <RoleOnly roles={["ADMIN"]}>
              <StudentFormPage />
            </RoleOnly>
          }
        />
        <Route
          path="/students/:id"
          element={
            <RoleOnly roles={["ADMIN", "TEACHER", "STUDENT"]}>
              <StudentProfilePage />
            </RoleOnly>
          }
        />
        <Route
          path="/teachers"
          element={
            <RoleOnly roles={["ADMIN"]}>
              <TeachersPage />
            </RoleOnly>
          }
        />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route
          path="/attendance/mark"
          element={
            <RoleOnly roles={["ADMIN", "TEACHER"]}>
              <AttendanceMarkPage />
            </RoleOnly>
          }
        />
        <Route path="/attendance/history" element={<AttendanceHistoryPage />} />
        <Route
          path="/settings"
          element={
            <RoleOnly roles={["ADMIN"]}>
              <SettingsPage />
            </RoleOnly>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
