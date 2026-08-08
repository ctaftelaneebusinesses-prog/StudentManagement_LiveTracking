import { Select } from "@/components/ui/Select";
import { ExtracurricularBatch } from "@/types/extracurricularPortal.types";
import { academicYearOptions, activityOptionsFor, classNameOptions, sectionOptions } from "../batchPicker";

export interface BatchPickerValue {
  academicYear: string;
  className: string;
  section: string;
  activityId: string;
}

export const EMPTY_BATCH_PICKER: BatchPickerValue = { academicYear: "", className: "", section: "", activityId: "" };

interface BatchClassPickerProps {
  batches: ExtracurricularBatch[];
  value: BatchPickerValue;
  onChange: (next: BatchPickerValue) => void;
  disabled?: boolean;
}

/**
 * Cascading Academic Year -> Class -> Section picker over a staff member's
 * own batches (replaces picking an opaque "Batch" by name). Only shows an
 * Activity picker if the resolved Year+Class+Section maps to more than one
 * batch (i.e. this staff member runs multiple activities for that class).
 */
export function BatchClassPicker({ batches, value, onChange, disabled }: BatchClassPickerProps) {
  const yearOptions = academicYearOptions(batches);
  const classOptions = value.academicYear ? classNameOptions(batches, value.academicYear) : [];
  const secOptions = value.academicYear && value.className ? sectionOptions(batches, value.academicYear, value.className) : [];
  const activityOptions =
    value.academicYear && value.className && value.section
      ? activityOptionsFor(batches, value.academicYear, value.className, value.section)
      : [];
  const showActivityPicker = activityOptions.length > 1;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select
        label="Academic year"
        placeholder="Select year"
        options={yearOptions}
        value={value.academicYear}
        disabled={disabled}
        onChange={(e) => onChange({ academicYear: e.target.value, className: "", section: "", activityId: "" })}
      />
      <Select
        label="Class"
        placeholder="Select class"
        options={classOptions}
        value={value.className}
        disabled={disabled || !value.academicYear}
        onChange={(e) => onChange({ ...value, className: e.target.value, section: "", activityId: "" })}
      />
      <Select
        label="Section"
        placeholder="Select section"
        options={secOptions}
        value={value.section}
        disabled={disabled || !value.className}
        onChange={(e) => onChange({ ...value, section: e.target.value, activityId: "" })}
      />
      {showActivityPicker && (
        <div className="sm:col-span-3">
          <Select
            label="Activity"
            placeholder="Select activity"
            options={activityOptions}
            value={value.activityId}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, activityId: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
