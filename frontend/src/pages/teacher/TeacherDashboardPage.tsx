import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import * as portalService from "@/services/teacher/portal.service";
import { TeacherClassSummary } from "@/types/teacher.types";

export function TeacherDashboardPage() {
  const { user } = useAuth();
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "dashboard"],
    queryFn: portalService.fetchDashboard,
  });

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", expandedClassId],
    queryFn: () => portalService.fetchRoster(expandedClassId!),
    enabled: !!expandedClassId,
  });

  if (isLoading) return <Spinner label="Loading your dashboard..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.full_name ?? "there"}</h1>
        <p className="text-sm text-slate-500">Here's an overview of your classes and subjects.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile label="Classes" value={data?.totalClasses ?? 0} />
        <SummaryTile label="Subjects" value={data?.totalSubjects ?? 0} />
        <SummaryTile label="Students" value={data?.totalStudents ?? 0} />
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">My classes</h2>
        {!data || data.classes.length === 0 ? (
          <p className="text-sm text-slate-500">You have not been assigned to any classes yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.classes.map((klass) => (
              <ClassRow
                key={klass.id}
                klass={klass}
                isExpanded={expandedClassId === klass.id}
                onToggle={() => setExpandedClassId(expandedClassId === klass.id ? null : klass.id)}
                roster={expandedClassId === klass.id ? rosterQuery.data : undefined}
                isRosterLoading={expandedClassId === klass.id && rosterQuery.isLoading}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  );
}

function ClassRow({
  klass,
  isExpanded,
  onToggle,
  roster,
  isRosterLoading,
}: {
  klass: TeacherClassSummary;
  isExpanded: boolean;
  onToggle: () => void;
  roster: Awaited<ReturnType<typeof portalService.fetchRoster>> | undefined;
  isRosterLoading: boolean;
}) {
  return (
    <li className="rounded-md border border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {klass.name} - {klass.section}
            {klass.isHomeroom && (
              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                Homeroom
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {klass.subjects.length === 0
              ? "No subjects assigned"
              : klass.subjects.map((s) => s.name).join(", ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">{klass.studentCount} student(s)</p>
        </div>
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={onToggle}>
          {isExpanded ? "Hide students" : "View students"}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <DataTable
            isLoading={isRosterLoading}
            rows={roster ?? []}
            rowKey={(s) => s.id}
            emptyMessage="No students in this class yet."
            columns={[
              { header: "Admission No", cell: (s) => s.admission_no },
              { header: "Roll No", cell: (s) => s.roll_no ?? "—" },
              { header: "Name", cell: (s) => s.users.full_name },
              { header: "Email", cell: (s) => s.users.email },
            ]}
          />
        </div>
      )}
    </li>
  );
}
