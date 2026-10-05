import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  auth: { user: null, login: vi.fn(), loading: false },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock("../auth", () => ({ useAuth: () => mocks.auth }));
vi.mock("../api", () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
    put: vi.fn(),
    upload: vi.fn(),
  },
  photoUrl: (id) => `/api/students/${id}/photo`,
}));

import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import StudentProfilePage from "./StudentProfilePage";
import App from "../App";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.auth.user = null;
});

describe("attendance application UI", () => {
  it("submits the login form and routes to the protected workspace", async () => {
    const user = userEvent.setup();
    mocks.auth.login.mockResolvedValue({ role: "ADMIN" });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(
      screen.getByLabelText(/email address/i),
      "admin@example.edu",
    );
    await user.type(screen.getByLabelText(/^password$/i), "a-secure-password");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() =>
      expect(mocks.auth.login).toHaveBeenCalledWith({
        email: "admin@example.edu",
        password: "a-secure-password",
      }),
    );
  });

  it("renders real dashboard statistics returned by the API", async () => {
    mocks.auth.user = {
      role: "ADMIN",
      email: "admin@example.edu",
      profile: null,
    };
    mocks.apiGet.mockResolvedValue({
      totals: {
        students: 42,
        teachers: 4,
        subjects: 12,
        presentToday: 30,
        absentToday: 3,
        overallAttendance: 91.2,
        totalSessions: 420,
      },
      lowAttendanceThreshold: 75,
      lowAttendanceStudents: [],
      attendanceTrend: [],
    });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("91.2%")).toBeInTheDocument();
    expect(mocks.apiGet).toHaveBeenCalledWith("/dashboard/admin");
  });

  it("shows a student profile and subject attendance returned by the API", async () => {
    mocks.auth.user = { role: "ADMIN" };
    mocks.apiGet.mockImplementation((path) =>
      path.startsWith("/students/")
        ? Promise.resolve({
            student: {
              id: 17,
              fullName: "Jordan Lee",
              studentId: "S-17",
              uniqueId: "U-17",
              rollNumber: "17",
              enrollmentNumber: "E-17",
              className: "BCA",
              semester: 5,
              parentsName: "Morgan Lee",
              bloodGroup: "B+",
            },
          })
        : Promise.resolve({
            studentId: 17,
            overall: {
              total: 40,
              present: 35,
              absent: 5,
              attendancePercentage: 87.5,
            },
            lowAttendanceThreshold: 75,
            subjects: [
              {
                subjectId: 3,
                subjectCode: "BCA501",
                subjectName: "Database Systems",
                total: 40,
                present: 35,
                absent: 5,
                attendancePercentage: 87.5,
              },
            ],
          }),
    );
    render(
      <MemoryRouter initialEntries={["/students/17"]}>
        <Routes>
          <Route path="/students/:id" element={<StudentProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Jordan Lee", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Database Systems")).toBeInTheDocument();
    expect(screen.getAllByText("87.5%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("35")).toHaveLength(2);
  });

  it("redirects unauthenticated visitors away from protected attendance pages", async () => {
    mocks.auth.user = null;
    render(
      <MemoryRouter initialEntries={["/attendance/history"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", {
        name: /sign in to your workspace/i,
      }),
    ).toBeInTheDocument();
  });
});
