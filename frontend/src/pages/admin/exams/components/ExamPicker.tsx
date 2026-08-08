import { Select } from "@/components/ui/Select";
import { Exam } from "@/types/exam.types";

interface ExamPickerProps {
  classes: { value: string; label: string }[];
  classFilter: string;
  onClassFilterChange: (value: string) => void;
  exams: Exam[];
  selectedExamId: string;
  onSelectExam: (id: string) => void;
  isLoading?: boolean;
}

export function ExamPicker({
  classes,
  classFilter,
  onClassFilterChange,
  exams,
  selectedExamId,
  onSelectExam,
  isLoading,
}: ExamPickerProps) {
  const examOptions = exams.map((e) => ({
    value: e.id,
    label: e.exam_date ? `${e.name} — ${e.exam_date}` : e.name,
  }));

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-56">
        <Select
          label="Class"
          placeholder="All classes"
          options={classes}
          value={classFilter}
          onChange={(e) => onClassFilterChange(e.target.value)}
        />
      </div>
      <div className="w-72">
        <Select
          label="Exam"
          placeholder={isLoading ? "Loading…" : "Select an exam"}
          options={examOptions}
          value={selectedExamId}
          onChange={(e) => onSelectExam(e.target.value)}
        />
      </div>
    </div>
  );
}
