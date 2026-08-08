import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Bus, ClipboardList, GraduationCap, Users, Wallet } from "lucide-react";
import { AttendanceReportsTab } from "./components/AttendanceReportsTab";
import { StudentReportsTab } from "./components/StudentReportsTab";
import { TeacherReportsTab } from "./components/TeacherReportsTab";
import { FeeReportsTab } from "./components/FeeReportsTab";
import { TransportReportsTab } from "./components/TransportReportsTab";
import { ExamReportsTab } from "./components/ExamReportsTab";

type TabKey = "attendance" | "students" | "teachers" | "fees" | "transport" | "exams";

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "attendance", label: "Attendance", icon: BarChart3 },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "teachers", label: "Teachers", icon: Users },
  { key: "fees", label: "Fees", icon: Wallet },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "exams", label: "Exams", icon: ClipboardList },
];

const TAB_KEYS = TABS.map((t) => t.key);

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(
    initialTab && TAB_KEYS.includes(initialTab as TabKey) ? (initialTab as TabKey) : "attendance"
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Reports</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Cross-module analytics and exportable reports across attendance, students, teachers, fees, transport, and exams.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-black/[0.06] bg-white p-1 dark:border-white/[0.08] dark:bg-[#17171a]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent-600 text-white shadow-sm"
                : "text-[var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === "attendance" && <AttendanceReportsTab />}
      {tab === "students" && <StudentReportsTab />}
      {tab === "teachers" && <TeacherReportsTab />}
      {tab === "fees" && <FeeReportsTab />}
      {tab === "transport" && <TransportReportsTab />}
      {tab === "exams" && <ExamReportsTab />}
    </div>
  );
}
