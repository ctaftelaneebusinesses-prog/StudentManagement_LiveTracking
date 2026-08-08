import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as classesService from "@/services/admin/classes.service";
import { ClassOverviewTab } from "./components/ClassOverviewTab";
import { ClassStudentsTab } from "./components/ClassStudentsTab";
import { ClassSubjectsTab } from "./components/ClassSubjectsTab";
import { ClassTimetableTab } from "./components/ClassTimetableTab";

type TabKey = "overview" | "subjects" | "students" | "timetable";

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classId = id ?? "";
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const classQuery = useQuery({
    queryKey: ["admin", "class", classId],
    queryFn: () => classesService.fetchClass(classId),
    enabled: !!classId,
  });

  if (classQuery.isError) {
    return <ErrorState message="This class couldn't be found." onRetry={() => classQuery.refetch()} />;
  }

  const klass = classQuery.data;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="!p-2 print:hidden"
          onClick={() => navigate("/dashboard/admin/classes")}
          title="Back"
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">
            {klass ? `${klass.name} - ${klass.section}` : "Loading…"}
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {klass?.academic_years?.name ?? "—"} · Class teacher: {klass?.class_teacher?.full_name ?? "Unassigned"}
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <Tabs
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "subjects", label: "Subjects" },
            { key: "students", label: "Students" },
            { key: "timetable", label: "Timetable" },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === "overview" && <ClassOverviewTab klass={klass} />}
      {activeTab === "subjects" && <ClassSubjectsTab classId={classId} />}
      {activeTab === "students" && <ClassStudentsTab classId={classId} klass={klass} />}
      {activeTab === "timetable" && (
        <ClassTimetableTab classId={classId} className={klass ? `${klass.name} - ${klass.section}` : ""} />
      )}
    </div>
  );
}
