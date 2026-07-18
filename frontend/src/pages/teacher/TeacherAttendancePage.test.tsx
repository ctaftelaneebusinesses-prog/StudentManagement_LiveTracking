import type { ReactElement } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { TeacherAttendancePage } from "./TeacherAttendancePage";
import * as portalService from "@/services/teacher/portal.service";
import * as attendanceService from "@/services/teacher/attendance.service";

vi.mock("@/services/teacher/portal.service");
vi.mock("@/services/teacher/attendance.service");

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const dashboardFixture = {
  classes: [
    { id: "class-1", name: "Grade 8", section: "A", isHomeroom: true, subjects: [], studentCount: 1 },
  ],
  totalClasses: 1,
  totalSubjects: 0,
  totalStudents: 1,
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

/** Waits for the dashboard-driven <option> to exist before selecting it — the options list populates asynchronously. */
async function selectClass(classId: string) {
  const classSelect = await screen.findByLabelText("Class", { selector: "#attendanceClassId" });
  await within(classSelect).findByRole("option", { name: "Grade 8 - A" });
  fireEvent.change(classSelect, { target: { value: classId } });
  return classSelect;
}

describe("TeacherAttendancePage", () => {
  it("loads the roster for the selected class, defaulting each student to Present", async () => {
    vi.mocked(portalService.fetchDashboard).mockResolvedValue(dashboardFixture);
    vi.mocked(portalService.fetchRoster).mockResolvedValue(rosterFixture);
    vi.mocked(attendanceService.fetchForClassDate).mockResolvedValue([]);
    vi.mocked(attendanceService.fetchHistory).mockResolvedValue([]);

    renderWithClient(<TeacherAttendancePage />);

    await selectClass("class-1");

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    const statusSelect = screen.getByDisplayValue("Present") as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
  });

  it("submits a bulk attendance update reflecting the chosen status", async () => {
    vi.mocked(portalService.fetchDashboard).mockResolvedValue(dashboardFixture);
    vi.mocked(portalService.fetchRoster).mockResolvedValue(rosterFixture);
    vi.mocked(attendanceService.fetchForClassDate).mockResolvedValue([]);
    vi.mocked(attendanceService.fetchHistory).mockResolvedValue([]);
    vi.mocked(attendanceService.bulkMarkAttendance).mockResolvedValue(undefined);

    renderWithClient(<TeacherAttendancePage />);

    await selectClass("class-1");
    await screen.findByText("Alice");

    const statusSelect = screen.getByDisplayValue("Present") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "absent" } });

    fireEvent.click(screen.getByText("Save attendance"));

    await waitFor(() =>
      expect(attendanceService.bulkMarkAttendance).toHaveBeenCalledWith(
        "class-1",
        expect.any(String),
        [expect.objectContaining({ student_id: "student-1", status: "absent" })]
      )
    );
  });
});
