import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { TeacherDashboardPage } from "./TeacherDashboardPage";
import * as portalService from "@/services/teacher/portal.service";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "teacher-1", full_name: "Jane Teacher", email: "jane@example.com", school_id: "school-1" },
  }),
}));

vi.mock("@/services/teacher/portal.service");

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const dashboardFixture = {
  classes: [
    {
      id: "class-1",
      name: "Grade 8",
      section: "A",
      isHomeroom: true,
      subjects: [{ id: "subj-1", name: "Math", code: "MTH" }],
      studentCount: 2,
    },
  ],
  totalClasses: 1,
  totalSubjects: 1,
  totalStudents: 2,
};

const rosterFixture = [
  {
    id: "student-1",
    admission_no: "A001",
    roll_no: "1",
    date_of_birth: null,
    gender: null,
    users: { full_name: "Alice", email: "alice@example.com", phone: null, avatar_url: null },
  },
];

describe("TeacherDashboardPage", () => {
  it("renders the teacher's classes, subjects, and summary counts without throwing", async () => {
    vi.mocked(portalService.fetchDashboard).mockResolvedValue(dashboardFixture);
    vi.mocked(portalService.fetchRoster).mockResolvedValue(rosterFixture);

    renderWithClient(<TeacherDashboardPage />);

    expect(await screen.findByText(/Welcome, Jane Teacher/)).toBeInTheDocument();
    expect(await screen.findByText(/Grade 8 - A/)).toBeInTheDocument();
    expect(screen.getByText("Homeroom")).toBeInTheDocument();
    expect(screen.getByText(/Math/)).toBeInTheDocument();
  });

  it("loads and displays the class roster when 'View students' is clicked", async () => {
    vi.mocked(portalService.fetchDashboard).mockResolvedValue(dashboardFixture);
    vi.mocked(portalService.fetchRoster).mockResolvedValue(rosterFixture);

    renderWithClient(<TeacherDashboardPage />);

    const viewButton = await screen.findByText("View students");
    fireEvent.click(viewButton);

    await waitFor(() => expect(portalService.fetchRoster).toHaveBeenCalledWith("class-1"));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("A001")).toBeInTheDocument();
  });
});
