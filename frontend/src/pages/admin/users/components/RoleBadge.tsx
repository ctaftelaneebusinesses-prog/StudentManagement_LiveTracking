import { RoleName } from "@/types/auth.types";
import { ROLE_LABEL } from "@/utils/roles";

// super_admin and school_admin are the same admin tier — identical badge style.
const ROLE_STYLES: Record<RoleName, string> = {
  super_admin: "bg-accent-500/10 text-accent-600 dark:text-accent-400",
  school_admin: "bg-accent-500/10 text-accent-600 dark:text-accent-400",
  principal: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  teacher: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  student: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  driver: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  support_staff: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  accountant: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  extracurricular_staff: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
};

export function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}
