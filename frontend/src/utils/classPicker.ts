import { ClassRoom } from "@/types/admin.types";

export interface SelectOption {
  value: string;
  label: string;
}

/** Distinct academic years represented among the given classes, sorted by name. */
export function academicYearOptions(classes: ClassRoom[]): SelectOption[] {
  const byId = new Map<string, string>();
  for (const c of classes) byId.set(c.academic_year_id, c.academic_years?.name ?? "Unknown year");
  return Array.from(byId, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Distinct class names (e.g. "Grade 7") offered within a given academic year. */
export function classNameOptions(classes: ClassRoom[], academicYearId: string): SelectOption[] {
  const names = new Set(classes.filter((c) => c.academic_year_id === academicYearId).map((c) => c.name));
  return Array.from(names)
    .sort()
    .map((name) => ({ value: name, label: name }));
}

/** Distinct sections offered for a given academic year + class name. */
export function sectionOptions(classes: ClassRoom[], academicYearId: string, className: string): SelectOption[] {
  const sections = new Set(
    classes.filter((c) => c.academic_year_id === academicYearId && c.name === className).map((c) => c.section)
  );
  return Array.from(sections)
    .sort()
    .map((section) => ({ value: section, label: section }));
}

/** Resolves an Academic Year + Class + Section combination to the concrete `classes.id` it maps to. */
export function resolveClassId(
  classes: ClassRoom[],
  academicYearId: string,
  className: string,
  section: string
): string | undefined {
  return classes.find(
    (c) => c.academic_year_id === academicYearId && c.name === className && c.section === section
  )?.id;
}
