import { ExtracurricularBatch } from "@/types/extracurricularPortal.types";

export interface SelectOption {
  value: string;
  label: string;
}

/** Distinct academic years represented among a staff member's own batches, newest first. */
export function academicYearOptions(batches: ExtracurricularBatch[]): SelectOption[] {
  const years = new Set(batches.map((b) => b.academic_years?.name).filter((y): y is string => !!y));
  return Array.from(years)
    .sort()
    .reverse()
    .map((y) => ({ value: y, label: y }));
}

/** Distinct class names (e.g. "Grade 7") this staff member has a batch in, for a given academic year. */
export function classNameOptions(batches: ExtracurricularBatch[], academicYear: string): SelectOption[] {
  const names = new Set(
    batches.filter((b) => b.academic_years?.name === academicYear).map((b) => b.classes!.name)
  );
  return Array.from(names)
    .sort()
    .map((name) => ({ value: name, label: name }));
}

/** Distinct sections for a given academic year + class name. */
export function sectionOptions(batches: ExtracurricularBatch[], academicYear: string, className: string): SelectOption[] {
  const sections = new Set(
    batches
      .filter((b) => b.academic_years?.name === academicYear && b.classes?.name === className)
      .map((b) => b.classes!.section)
  );
  return Array.from(sections)
    .sort()
    .map((section) => ({ value: section, label: section }));
}

/**
 * Activities this staff member runs for the given Year+Class+Section — only
 * meaningful (and only rendered by the caller) when it resolves to more than
 * one batch, i.e. the staff runs multiple activities for the same class.
 */
export function activityOptionsFor(
  batches: ExtracurricularBatch[],
  academicYear: string,
  className: string,
  section: string
): SelectOption[] {
  return batches
    .filter(
      (b) => b.academic_years?.name === academicYear && b.classes?.name === className && b.classes?.section === section
    )
    .map((b) => ({ value: b.activity_id, label: b.activities?.name ?? "Activity" }));
}

/**
 * Resolves an Academic Year + Class + Section (+ Activity, when ambiguous)
 * combination to the concrete batch it maps to — the batch-picker analogue of
 * classPicker.ts's `resolveClassId`.
 */
export function resolveBatch(
  batches: ExtracurricularBatch[],
  academicYear: string,
  className: string,
  section: string,
  activityId?: string
): ExtracurricularBatch | undefined {
  const matches = batches.filter(
    (b) => b.academic_years?.name === academicYear && b.classes?.name === className && b.classes?.section === section
  );
  if (matches.length <= 1) return matches[0];
  return matches.find((b) => b.activity_id === activityId);
}
