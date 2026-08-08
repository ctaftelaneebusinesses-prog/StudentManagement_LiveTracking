/**
 * Default password scheme: first 5 letters of the person's name + an
 * identifying number they already have (roll no, employee ID, license
 * number, ...) — e.g. "Ctaft11". Padded if the name is short, and
 * non-alphanumeric characters stripped so it's always accepted.
 */
export function generateDefaultPassword(fullName: string, idPart?: string): string {
  const cleanName = (fullName || "").replace(/[^a-zA-Z]/g, "") || "user";
  const namePart = (cleanName + "xxxxx").slice(0, 5);
  const cleanId = (idPart || "").replace(/[^a-zA-Z0-9]/g, "");
  const idSuffix = cleanId || String(Math.floor(1000 + Math.random() * 9000));
  return namePart + idSuffix;
}
