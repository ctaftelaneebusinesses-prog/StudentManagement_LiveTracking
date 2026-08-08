import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer } from "lucide-react";
import { getApiErrorMessage } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as classesService from "@/services/admin/classes.service";
import * as teachersService from "@/services/admin/teachers.service";
import * as timetableService from "@/services/admin/timetable.service";
import { SCHOOL_WEEK_DAYS, TimetablePeriodEntry, TimetablePeriodType, WEEKDAY_NAMES } from "@/types/timetable.types";
import { PeriodModal } from "./timetable/components/PeriodModal";
import { TimetableGrid, TimetableGridSkeleton } from "./timetable/components/TimetableGrid";
import { TimetableSuggestionsPanel } from "./timetable/components/TimetableSuggestionsPanel";
import { exportTimetableToPdf } from "./timetable/utils";

const MIN_PERIOD_ROWS = 8;

interface SelectedCell {
  dayOfWeek: number;
  periodNo: number;
  existing: TimetablePeriodEntry | null;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

interface PeriodFormValues {
  period_type: TimetablePeriodType;
  subject_id: string;
  activity_id: string;
  teacher_id: string;
  room_number: string;
  start_time: string;
  end_time: string;
}

export function TimetablePage() {
  const queryClient = useQueryClient();
  const [selectedClassName, setSelectedClassName] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [extraRows, setExtraRows] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
  });

  const classNames = useMemo(() => Array.from(new Set(classes.map((c) => c.name))), [classes]);
  const sectionsForName = useMemo(
    () => classes.filter((c) => c.name === selectedClassName).map((c) => c.section),
    [classes, selectedClassName]
  );
  const selectedClass = classes.find((c) => c.name === selectedClassName && c.section === selectedSection) ?? null;

  const { data: teacherPage } = useQuery({
    queryKey: ["admin", "teachers", "all"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 1000 }),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["admin", "subjects"],
    queryFn: classesService.fetchSubjects,
  });
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["admin", "classes", selectedClass?.id, "subjects"],
    queryFn: () => classesService.fetchClassSubjects(selectedClass!.id),
    enabled: !!selectedClass,
  });

  const periodsQuery = useQuery({
    queryKey: ["admin", "timetable", selectedClass?.id],
    queryFn: () => timetableService.fetchTimetableForClass(selectedClass!.id),
    enabled: !!selectedClass,
  });

  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data]);
  const maxExistingPeriodNo = periods.reduce((max, p) => Math.max(max, p.period_no), 0);
  const periodNumbers = Array.from(
    { length: Math.max(MIN_PERIOD_ROWS, maxExistingPeriodNo) + extraRows },
    (_, i) => i + 1
  );

  function getCell(periodNo: number, dayOfWeek: number) {
    return periods.find((p) => p.period_no === periodNo && p.day_of_week === dayOfWeek);
  }

  function invalidateTimetable() {
    queryClient.invalidateQueries({ queryKey: ["admin", "timetable", selectedClass?.id] });
  }

  const saveMutation = useMutation({
    mutationFn: (values: PeriodFormValues) => {
      if (!selectedClass || !selectedCell) throw new Error("No cell selected");
      return timetableService.upsertPeriod({
        class_id: selectedClass.id,
        day_of_week: selectedCell.dayOfWeek,
        period_no: selectedCell.periodNo,
        period_type: values.period_type,
        subject_id: values.subject_id || undefined,
        activity_id: values.activity_id || undefined,
        teacher_id: values.teacher_id || undefined,
        room_number: values.room_number || undefined,
        start_time: values.start_time,
        end_time: values.end_time,
      });
    },
    onSuccess: () => {
      invalidateTimetable();
      setSelectedCell(null);
      setSaveError(null);
    },
    onError: (err) => setSaveError(getApiErrorMessage(err, "Failed to save this period.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timetableService.deletePeriod(id),
    onSuccess: () => {
      invalidateTimetable();
      setSelectedCell(null);
      setSaveError(null);
    },
  });

  function openCell(periodNo: number, dayOfWeek: number) {
    const existing = getCell(periodNo, dayOfWeek) ?? null;
    const sibling = periods.find((p) => p.period_no === periodNo);
    setSaveError(null);
    setSelectedCell({
      periodNo,
      dayOfWeek,
      existing,
      defaultStartTime: sibling?.start_time?.slice(0, 5),
      defaultEndTime: sibling?.end_time?.slice(0, 5),
    });
  }

  async function handleDownloadPdf() {
    if (!selectedClass) return;
    await exportTimetableToPdf(
      `${selectedClass.name} - ${selectedClass.section} - Weekly Timetable`,
      SCHOOL_WEEK_DAYS.map((d) => ({ dayOfWeek: d, label: WEEKDAY_NAMES[d] })),
      periodNumbers,
      getCell
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Timetable</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Build each class's weekly schedule with automatic teacher and room conflict detection.
        </p>
      </div>

      <TimetableSuggestionsPanel />

      <ChartCard title="Select class &amp; section" className="print:hidden">
        <div className="flex flex-wrap gap-4">
          <Select
            label="Class"
            placeholder="Select class"
            options={classNames.map((n) => ({ value: n, label: n }))}
            value={selectedClassName}
            onChange={(e) => {
              setSelectedClassName(e.target.value);
              setSelectedSection("");
              setExtraRows(0);
            }}
          />
          <Select
            label="Section"
            placeholder="Select section"
            options={sectionsForName.map((s) => ({ value: s, label: s }))}
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={!selectedClassName}
          />
        </div>
      </ChartCard>

      {!selectedClass ? (
        <ChartCard title="Weekly timetable">
          <EmptyState
            title="Select a class and section"
            description="Choose a class and section above to view or build its weekly timetable."
          />
        </ChartCard>
      ) : periodsQuery.isError ? (
        <ErrorState message="Couldn't load this class's timetable." onRetry={() => periodsQuery.refetch()} />
      ) : (
        <ChartCard
          title={`${selectedClass.name} - ${selectedClass.section} — Weekly Timetable`}
          subtitle="Click any cell to add or edit a period"
          className="print:border-0 print:shadow-none"
          legend={
            <div className="flex gap-2 print:hidden">
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => window.print()}>
                <Printer size={14} className="mr-1" />
                Print
              </Button>
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={handleDownloadPdf}>
                <Download size={14} className="mr-1" />
                Download PDF
              </Button>
            </div>
          }
        >
          {periodsQuery.isLoading ? (
            <TimetableGridSkeleton />
          ) : (
            <TimetableGrid periodNumbers={periodNumbers} getCell={getCell} onCellClick={openCell} />
          )}
          <div className="mt-2 print:hidden">
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setExtraRows((n) => n + 1)}>
              <Plus size={14} className="mr-1" />
              Add another period row
            </Button>
          </div>
        </ChartCard>
      )}

      <PeriodModal
        cell={selectedCell}
        classSubjects={classSubjects}
        subjects={subjects}
        teachers={teacherPage?.items ?? []}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        saveError={saveError}
        onSave={(values) => saveMutation.mutate(values)}
        onDelete={() => selectedCell?.existing && deleteMutation.mutate(selectedCell.existing.id)}
        onClose={() => {
          setSelectedCell(null);
          setSaveError(null);
        }}
      />
    </div>
  );
}
