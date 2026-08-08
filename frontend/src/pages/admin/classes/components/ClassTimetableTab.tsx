import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer } from "lucide-react";
import { getApiErrorMessage } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as classesService from "@/services/admin/classes.service";
import * as teachersService from "@/services/admin/teachers.service";
import * as timetableService from "@/services/admin/timetable.service";
import { SCHOOL_WEEK_DAYS, TimetablePeriodEntry, TimetablePeriodType, WEEKDAY_NAMES } from "@/types/timetable.types";
import { PeriodModal } from "@/pages/admin/timetable/components/PeriodModal";
import { TimetableGrid, TimetableGridSkeleton } from "@/pages/admin/timetable/components/TimetableGrid";
import { exportTimetableToPdf } from "@/pages/admin/timetable/utils";

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

export function ClassTimetableTab({ classId, className }: { classId: string; className: string }) {
  const queryClient = useQueryClient();
  const [extraRows, setExtraRows] = useState(0);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: teacherPage } = useQuery({
    queryKey: ["admin", "teachers", "all"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 1000 }),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["admin", "subjects"],
    queryFn: classesService.fetchSubjects,
  });
  const { data: classSubjects = [] } = useQuery({
    queryKey: ["admin", "class", classId, "subjects"],
    queryFn: () => classesService.fetchClassSubjects(classId),
    enabled: !!classId,
  });

  const periodsQuery = useQuery({
    queryKey: ["admin", "timetable", classId],
    queryFn: () => timetableService.fetchTimetableForClass(classId),
    enabled: !!classId,
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
    queryClient.invalidateQueries({ queryKey: ["admin", "timetable", classId] });
    // A period's teacher is mirrored onto class_subjects.teacher_id server-side — keep the Subjects tab in sync.
    queryClient.invalidateQueries({ queryKey: ["admin", "class", classId, "subjects"] });
  }

  const saveMutation = useMutation({
    mutationFn: (values: PeriodFormValues) => {
      if (!selectedCell) throw new Error("No cell selected");
      return timetableService.upsertPeriod({
        class_id: classId,
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
    await exportTimetableToPdf(
      `${className} - Weekly Timetable`,
      SCHOOL_WEEK_DAYS.map((d) => ({ dayOfWeek: d, label: WEEKDAY_NAMES[d] })),
      periodNumbers,
      getCell
    );
  }

  if (periodsQuery.isError) {
    return <ErrorState message="Couldn't load this class's timetable." onRetry={() => periodsQuery.refetch()} />;
  }

  return (
    <>
      <ChartCard
        title="Weekly Timetable"
        subtitle="Click any cell to add or edit a period"
        className="print:rounded-none print:border-0 print:shadow-none"
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
    </>
  );
}
