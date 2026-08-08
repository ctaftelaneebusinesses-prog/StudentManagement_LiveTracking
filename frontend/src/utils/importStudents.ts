import { ClassRoom } from "@/types/admin.types";
import { CreateStudentInput } from "@/services/admin/students.service";

export interface ParsedStudentRow {
  rowNumber: number;
  input: CreateStudentInput;
  classLabel?: string;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export interface ParseStudentsWorkbookResult {
  rows: ParsedStudentRow[];
  errors: ImportRowError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Header aliases accepted per canonical field — matched case/space/underscore-insensitively. */
const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ["full name", "name", "student name"],
  email: ["email", "email address"],
  admission_no: ["admission no", "admission number", "admission_no"],
  roll_no: ["roll no", "roll number", "roll_no"],
  phone: ["phone", "phone number", "mobile"],
  date_of_birth: ["date of birth", "dob", "date_of_birth"],
  gender: ["gender", "sex"],
  address: ["address"],
  class_name: ["class", "class name", "grade"],
  section: ["section"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

function buildHeaderMap(headers: string[]): Map<string, string> {
  const normalizedAliases = new Map<string, string>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) normalizedAliases.set(normalizeHeader(alias), field);
  }

  const map = new Map<string, string>();
  for (const header of headers) {
    const field = normalizedAliases.get(normalizeHeader(header));
    if (field) map.set(header, field);
  }
  return map;
}

function normalizeGender(value: unknown): "male" | "female" | "other" | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "male" || v === "m") return "male";
  if (v === "female" || v === "f") return "female";
  if (v === "other" || v === "o") return "other";
  return undefined;
}

/** Excel stores dates as serial numbers; everything else comes through as text we pass along as-is. */
function normalizeDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + value);
    return epoch.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/**
 * Parses a .xlsx/.csv file into student rows ready for bulk import. `xlsx` is
 * dynamically imported — the same lazy-load pattern as the existing
 * export utils — since a user who never imports never downloads it.
 */
export async function parseStudentsWorkbook(
  file: File,
  classes: ClassRoom[]
): Promise<ParseStudentsWorkbookResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], errors: [{ rowNumber: 0, message: "The file has no sheets." }] };

  const sheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedStudentRow[] = [];
  const errors: ImportRowError[] = [];

  records.forEach((record, i) => {
    const rowNumber = i + 2; // header is row 1
    const headerMap = buildHeaderMap(Object.keys(record));
    const fields: Record<string, unknown> = {};
    for (const [header, field] of headerMap) fields[field] = record[header];

    const fullName = String(fields.full_name ?? "").trim();
    const email = String(fields.email ?? "").trim();
    const admissionNo = String(fields.admission_no ?? "").trim();

    if (!fullName || !email || !admissionNo) {
      errors.push({ rowNumber, message: "Missing required field (name, email, or admission number)." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ rowNumber, message: `"${email}" doesn't look like a valid email.` });
      return;
    }

    const className = String(fields.class_name ?? "").trim();
    const section = String(fields.section ?? "").trim();
    let classId: string | undefined;
    let classLabel: string | undefined;

    if (className) {
      const match = classes.find(
        (c) =>
          c.name.trim().toLowerCase() === className.toLowerCase() &&
          (!section || c.section.trim().toLowerCase() === section.toLowerCase())
      );
      if (match) {
        classId = match.id;
        classLabel = `${match.name} - ${match.section}`;
      } else {
        errors.push({
          rowNumber,
          message: `No matching class for "${className}${section ? ` - ${section}` : ""}" — row will be imported unassigned.`,
        });
      }
    }

    rows.push({
      rowNumber,
      classLabel,
      input: {
        full_name: fullName,
        email,
        admission_no: admissionNo,
        roll_no: String(fields.roll_no ?? "").trim() || undefined,
        phone: String(fields.phone ?? "").trim() || undefined,
        address: String(fields.address ?? "").trim() || undefined,
        gender: normalizeGender(fields.gender),
        date_of_birth: normalizeDate(fields.date_of_birth),
        class_id: classId,
      },
    });
  });

  return { rows, errors };
}
