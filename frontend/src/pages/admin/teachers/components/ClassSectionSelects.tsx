import { Select } from "@/components/ui/Select";
import { ClassRoom } from "@/types/admin.types";
import { academicYearOptions, classNameOptions, sectionOptions } from "@/utils/classPicker";

export interface ClassSectionValue {
  academicYearId: string;
  className: string;
  section: string;
}

interface ClassSectionSelectsProps {
  classes: ClassRoom[];
  value: ClassSectionValue;
  onChange: (next: ClassSectionValue) => void;
  disabled?: boolean;
  errors?: { academicYearId?: string; className?: string; section?: string };
}

/**
 * Cascading Academic Year -> Class -> Section pickers, backed by the existing
 * classes list (no separate master data). Renders three bare `Select`s with
 * no wrapping grid, so callers can lay them out alongside other fields (e.g.
 * a 4th "Subject" select) in their own grid.
 */
export function ClassSectionSelects({ classes, value, onChange, disabled, errors }: ClassSectionSelectsProps) {
  const yearOptions = academicYearOptions(classes);
  const gradeOptions = value.academicYearId ? classNameOptions(classes, value.academicYearId) : [];
  const secOptions =
    value.academicYearId && value.className ? sectionOptions(classes, value.academicYearId, value.className) : [];

  return (
    <>
      <Select
        label="Academic year"
        placeholder="Select year"
        options={yearOptions}
        value={value.academicYearId}
        disabled={disabled}
        error={errors?.academicYearId}
        onChange={(e) => onChange({ academicYearId: e.target.value, className: "", section: "" })}
      />
      <Select
        label="Class"
        placeholder="Select class"
        options={gradeOptions}
        value={value.className}
        disabled={disabled || !value.academicYearId}
        error={errors?.className}
        onChange={(e) => onChange({ ...value, className: e.target.value, section: "" })}
      />
      <Select
        label="Section"
        placeholder="Select section"
        options={secOptions}
        value={value.section}
        disabled={disabled || !value.className}
        error={errors?.section}
        onChange={(e) => onChange({ ...value, section: e.target.value })}
      />
    </>
  );
}
