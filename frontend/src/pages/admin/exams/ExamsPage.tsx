import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CalendarClock, FileText, Trophy, BarChart3 } from "lucide-react";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import * as examsService from "@/services/admin/exams.service";
import * as classesService from "@/services/admin/classes.service";
import { ExamsTab } from "./components/ExamsTab";
import { TimetableTab } from "./components/TimetableTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { ResultsTab } from "./components/ResultsTab";
import { ReportsTab } from "./components/ReportsTab";
import { ExamPicker } from "./components/ExamPicker";

type TabKey = "exams" | "timetable" | "documents" | "results" | "reports";

const TABS: TabItem<TabKey>[] = [
  { key: "exams", label: "Exams", icon: ClipboardList },
  { key: "timetable", label: "Timetable", icon: CalendarClock },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "results", label: "Results", icon: Trophy },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

export function ExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedExamId = searchParams.get("examId");
  const [tab, setTab] = useState<TabKey>(linkedExamId ? "results" : "exams");
  const [classFilter, setClassFilter] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  const { data: classes = [] } = useQuery({ queryKey: ["admin", "classes"], queryFn: classesService.fetchClasses });
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.name} - ${c.section}` }));

  const examsQuery = useQuery({
    queryKey: ["admin", "exams", classFilter],
    queryFn: () => examsService.fetchExams(classFilter || undefined),
  });
  const exams = examsQuery.data ?? [];

  // Keep the shared "selected exam" valid as the (filtered) exam list changes —
  // default to the most recent exam so Timetable/Documents/Results/Reports
  // have something useful to show without the admin picking one first.
  useEffect(() => {
    if (exams.length === 0) {
      if (selectedExamId) setSelectedExamId("");
      return;
    }
    if (linkedExamId && exams.some((e) => e.id === linkedExamId)) {
      setSelectedExamId(linkedExamId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("examId");
        return next;
      });
      return;
    }
    if (!exams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(exams[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, linkedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;

  const picker = (
    <ExamPicker
      classes={classOptions}
      classFilter={classFilter}
      onClassFilterChange={setClassFilter}
      exams={exams}
      selectedExamId={selectedExamId}
      onSelectExam={setSelectedExamId}
      isLoading={examsQuery.isLoading}
    />
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Examination Module</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Create exams, build subject schedules, manage documents, and publish results.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "exams" && (
        <ExamsTab
          classes={classOptions}
          classFilter={classFilter}
          onClassFilterChange={setClassFilter}
          exams={exams}
          isLoading={examsQuery.isLoading}
          onManage={(examId) => {
            setSelectedExamId(examId);
            setTab("timetable");
          }}
        />
      )}
      {tab === "timetable" && <TimetableTab exam={selectedExam} picker={picker} />}
      {tab === "documents" && <DocumentsTab exam={selectedExam} picker={picker} />}
      {tab === "results" && <ResultsTab exam={selectedExam} picker={picker} />}
      {tab === "reports" && <ReportsTab exam={selectedExam} picker={picker} />}
    </div>
  );
}
