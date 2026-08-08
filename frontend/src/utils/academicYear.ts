/** Derives an academic-year label ("2026" or "2026–2027") from ISO start/end dates. */
export function deriveAcademicYearLabel(startIso: string, endIso: string): string {
  const startYear = startIso ? Number(startIso.slice(0, 4)) : NaN;
  const endYear = endIso ? Number(endIso.slice(0, 4)) : NaN;
  if (!startYear || !endYear) return "";
  return startYear === endYear ? `${startYear}` : `${startYear}–${endYear}`;
}
