import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useSchool } from "@/hooks/useSchool";

export function SchoolSelectorMenu() {
  const { schools, selectedSchool, setSelectedSchoolId, canSwitchSchools } = useSchool();
  const queryClient = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!canSwitchSchools) return null;

  function selectSchool(schoolId: string) {
    setSelectedSchoolId(schoolId);
    setOpen(false);
    // "Refresh the application" for the newly selected school — every admin
    // query keys off an ["admin", ...] prefix, so one broad invalidate covers
    // dashboards/students/teachers/classes/fees/transport/reports in place.
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-black/[0.02] px-2.5 py-1.5 text-left transition-colors hover:bg-black/[0.05] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-300">
          <Building2 size={13} strokeWidth={2} />
        </span>
        <span className="hidden max-w-[160px] truncate text-sm font-medium text-[var(--ink-primary)] sm:inline">
          {selectedSchool.name}
        </span>
        <ChevronDown size={14} className="text-[var(--ink-muted)]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-2 w-80 animate-slide-up rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-xl dark:border-white/[0.1] dark:bg-[#1c1c1f]">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Switch school
          </p>
          {schools.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => selectSchool(school.id)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                <Building2 size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--ink-primary)]">{school.name}</span>
                <span className="block text-xs text-[var(--ink-muted)]">{school.code}</span>
              </span>
              {school.id === selectedSchool.id && (
                <Check size={16} className="mt-1 shrink-0 text-accent-600 dark:text-accent-300" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
