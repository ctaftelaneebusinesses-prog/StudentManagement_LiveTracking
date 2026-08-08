import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  Globe,
  Layers,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import * as classesService from "@/services/admin/classes.service";
import * as teachersService from "@/services/admin/teachers.service";
import * as extracurricularStaffService from "@/services/admin/extracurricularStaff.service";
import { useAuth } from "@/hooks/useAuth";
import { AudienceType, AUDIENCE_LABEL } from "@/types/announcement.types";

const OPTIONS: { value: AudienceType; icon: LucideIcon }[] = [
  { value: "all", icon: Globe },
  { value: "principal", icon: UserCog },
  { value: "teachers", icon: Users },
  { value: "specific_teachers", icon: UserCheck },
  { value: "students", icon: GraduationCap },
  { value: "classes", icon: Layers },
  { value: "accountants", icon: Wallet },
  { value: "extracurricular_staff", icon: Sparkles },
  { value: "specific_extracurricular_staff", icon: UserCheck },
];

// Staff-directory audiences restricted to Admin/Principal — mirrors the
// backend's RESTRICTED_AUDIENCE_TYPES guard in announcementAccess.ts.
const RESTRICTED_AUDIENCE_TYPES: AudienceType[] = ["principal", "accountants", "extracurricular_staff", "specific_extracurricular_staff"];

interface AudiencePickerProps {
  value: AudienceType;
  onChange: (value: AudienceType) => void;
  classIds: string[];
  onClassIdsChange: (ids: string[]) => void;
  teacherIds: string[];
  onTeacherIdsChange: (ids: string[]) => void;
  ecStaffIds: string[];
  onEcStaffIdsChange: (ids: string[]) => void;
}

/** All / Principal / Teachers / Specific teachers / Students / Selected Classes / Accountants /
 * Extracurricular Staff / Specific staff — "Selected Classes" and "Selected Sections" are the same targeting
 * mechanism here, since a `classes` row already is one class+section pair. Principal, Accountants, and
 * Extracurricular Staff are hidden for a teacher-only actor (see isTeacherOnly below) — only Admin/Principal may
 * target those staff-directory audiences. */
export function AudiencePicker({
  value,
  onChange,
  classIds,
  onClassIdsChange,
  teacherIds,
  onTeacherIdsChange,
  ecStaffIds,
  onEcStaffIdsChange,
}: AudiencePickerProps) {
  const { hasRole } = useAuth();
  // A teacher (who also holds announcements.manage) must not be able to
  // page these staff-directory audiences via a mass announcement — matches
  // the backend guard in announcementAccess.ts, hiding the option instead
  // of letting it 403.
  const isTeacherOnly = hasRole("teacher") && !hasRole("school_admin") && !hasRole("super_admin") && !hasRole("principal");
  const visibleOptions = OPTIONS.filter((o) => !RESTRICTED_AUDIENCE_TYPES.includes(o.value) || !isTeacherOnly);

  const { data: classes = [] } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: classesService.fetchClasses,
    enabled: value === "classes",
  });

  const { data: teachersResult } = useQuery({
    queryKey: ["admin", "teachers", "audience-picker"],
    queryFn: () => teachersService.fetchTeachers({ pageSize: 200 }),
    enabled: value === "specific_teachers",
  });
  const teachers = teachersResult?.items ?? [];

  const { data: ecStaffResult } = useQuery({
    queryKey: ["admin", "extracurricular-staff", "audience-picker"],
    queryFn: () => extracurricularStaffService.fetchExtracurricularStaffList({ pageSize: 200 }),
    enabled: value === "specific_extracurricular_staff",
  });
  const ecStaffMembers = ecStaffResult?.items ?? [];

  function toggleClass(id: string) {
    onClassIdsChange(classIds.includes(id) ? classIds.filter((c) => c !== id) : [...classIds, id]);
  }

  function toggleTeacher(id: string) {
    onTeacherIdsChange(teacherIds.includes(id) ? teacherIds.filter((t) => t !== id) : [...teacherIds, id]);
  }

  function toggleEcStaff(id: string) {
    onEcStaffIdsChange(ecStaffIds.includes(id) ? ecStaffIds.filter((s) => s !== id) : [...ecStaffIds, id]);
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Send to</label>
      <div className="flex flex-wrap gap-2">
        {visibleOptions.map(({ value: v, icon: Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              value === v
                ? "border-accent-600 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-500/10 dark:text-accent-300"
                : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <Icon size={15} strokeWidth={1.85} />
            {AUDIENCE_LABEL[v]}
          </button>
        ))}
      </div>

      {value === "classes" && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
          {classes.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-400">No classes found.</p>
          ) : (
            classes.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={classIds.includes(c.id)}
                  onChange={() => toggleClass(c.id)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {c.name} - {c.section}
              </label>
            ))
          )}
        </div>
      )}

      {value === "specific_teachers" && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
          {teachers.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-400">No teachers found.</p>
          ) : (
            teachers.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={teacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {t.users.full_name}
              </label>
            ))
          )}
        </div>
      )}

      {value === "specific_extracurricular_staff" && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">
          {ecStaffMembers.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-400">No extracurricular staff found.</p>
          ) : (
            ecStaffMembers.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={ecStaffIds.includes(s.id)}
                  onChange={() => toggleEcStaff(s.id)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {s.users.full_name}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
