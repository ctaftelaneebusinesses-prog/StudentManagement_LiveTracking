/**
 * Fallback password scheme when no password is supplied directly (e.g. a
 * bulk-import row): first 5 letters of the person's name + an identifying
 * number they already have (roll no, employee ID, license number, ...).
 * Padded/stripped so the result always satisfies Supabase's minimum length.
 */
export function generateDefaultPassword(fullName: string, idPart?: string): string {
  const cleanName = (fullName || "").replace(/[^a-zA-Z]/g, "") || "user";
  const namePart = (cleanName + "xxxxx").slice(0, 5);
  const cleanId = (idPart || "").replace(/[^a-zA-Z0-9]/g, "");
  const idSuffix = cleanId || String(Math.floor(1000 + Math.random() * 9000));
  return namePart + idSuffix;
}
