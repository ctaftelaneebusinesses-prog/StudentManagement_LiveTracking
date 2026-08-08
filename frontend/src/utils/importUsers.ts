import { CreateUserInput } from "@/services/admin/users.service";
import { ROLE_ID } from "@/utils/roles";
import { RoleName } from "@/types/auth.types";

export interface ParsedUserRow {
  rowNumber: number;
  input: CreateUserInput;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
}

export interface ParseUsersWorkbookResult {
  rows: ParsedUserRow[];
  errors: ImportRowError[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADER_ALIASES: Record<string, string[]> = {
  full_name: ["full name", "name"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile"],
  role: ["role"],
  designation: ["designation", "job title"],
};

// Deliberately excludes teacher/student/driver/extracurricular_staff
// — see the comment on ASSIGNABLE_ROLE_OPTIONS in utils/roles.ts for why:
// each needs an extension-table row this generic import has no way to fill
// in, and the backend rejects these role ids for this endpoint regardless.
const ROLE_NAME_ALIASES: Record<string, RoleName> = {
  admin: "school_admin",
  "school admin": "school_admin",
  school_admin: "school_admin",
  principal: "principal",
  "support staff": "support_staff",
  support_staff: "support_staff",
  accountant: "accountant",
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

/** Parses a .xlsx/.csv file into user rows ready for bulk import — same lazy-loaded `xlsx` pattern as importStudents.ts. */
export async function parseUsersWorkbook(file: File): Promise<ParseUsersWorkbookResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], errors: [{ rowNumber: 0, message: "The file has no sheets." }] };

  const sheet = workbook.Sheets[firstSheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedUserRow[] = [];
  const errors: ImportRowError[] = [];

  records.forEach((record, i) => {
    const rowNumber = i + 2;
    const headerMap = buildHeaderMap(Object.keys(record));
    const fields: Record<string, unknown> = {};
    for (const [header, field] of headerMap) fields[field] = record[header];

    const fullName = String(fields.full_name ?? "").trim();
    const email = String(fields.email ?? "").trim();
    const roleRaw = String(fields.role ?? "").trim().toLowerCase();

    if (!fullName || !email || !roleRaw) {
      errors.push({ rowNumber, message: "Missing required field (name, email, or role)." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ rowNumber, message: `"${email}" doesn't look like a valid email.` });
      return;
    }
    const roleName = ROLE_NAME_ALIASES[roleRaw];
    if (!roleName) {
      errors.push({
        rowNumber,
        message: `"${fields.role}" isn't a role this import supports (admin, principal, support staff, accountant). Teachers, students, and drivers each need their own dedicated import/add flow, which collects the extra details that role requires.`,
      });
      return;
    }

    rows.push({
      rowNumber,
      input: {
        full_name: fullName,
        email,
        phone: String(fields.phone ?? "").trim() || undefined,
        designation: String(fields.designation ?? "").trim() || undefined,
        role_id: ROLE_ID[roleName],
      },
    });
  });

  return { rows, errors };
}
