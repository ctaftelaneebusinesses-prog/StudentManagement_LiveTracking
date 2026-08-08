import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, GraduationCap, Search, Users, XCircle } from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { PlatformSchool } from "@/types/superAdmin.types";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, StatusPill } from "./components/PageHeader";
import { ImpactDialog } from "./components/ImpactDialog";

type StatusFilter = "all" | "active" | "inactive";

/**
 * §8/§9/§13 — the platform's school directory.
 *
 * Rows are selectable so one school or many can be deactivated in a single
 * confirmed action; the impact numbers in the dialog come from the server, not
 * from the rows rendered here.
 */
export function SuperAdminSchoolsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<{ ids: string[]; activate: boolean } | null>(null);

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools"],
    queryFn: superAdminService.listSchools,
  });

  const impactQuery = useQuery({
    queryKey: ["super-admin", "schools", "impact", pendingAction?.ids],
    queryFn: () => superAdminService.previewSchoolsImpact(pendingAction!.ids),
    enabled: Boolean(pendingAction),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ ids, activate }: { ids: string[]; activate: boolean }) =>
      superAdminService.setSchoolsActive(ids, activate),
    onSuccess: (result, variables) => {
      const verb = variables.activate ? "reactivated" : "deactivated";
      const count = variables.ids.length;
      toast.success(
        `${count} school${count === 1 ? "" : "s"} ${verb} — ${result.usersAffected} user account${
          result.usersAffected === 1 ? "" : "s"
        } affected.`
      );
      setPendingAction(null);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't update schools"),
  });

  const schools = schoolsQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return schools.filter((school) => {
      if (statusFilter === "active" && !school.is_active) return false;
      if (statusFilter === "inactive" && school.is_active) return false;
      if (!term) return true;
      return (
        school.name.toLowerCase().includes(term) ||
        school.code.toLowerCase().includes(term) ||
        (school.city ?? "").toLowerCase().includes(term) ||
        (school.district ?? "").toLowerCase().includes(term)
      );
    });
  }, [schools, search, statusFilter]);

  const selectableIds = filtered.map((s) => s.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  function toggleAll() {
    setSelectedIds(allSelected ? [] : selectableIds);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const selectedSchools = schools.filter((s) => selectedIds.includes(s.id));
  const canBulkDeactivate = selectedSchools.some((s) => s.is_active);
  const canBulkActivate = selectedSchools.some((s) => !s.is_active);

  const pendingSchools = pendingAction ? schools.filter((s) => pendingAction.ids.includes(s.id)) : [];

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={`${schools.length} school${schools.length === 1 ? "" : "s"} on the platform`}
        actions={
          <Button onClick={() => navigate("/dashboard/admin/schools")} variant="secondary">
            Add / edit school details
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            strokeWidth={1.9}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, city or district…"
            className="w-full rounded-xl border border-black/[0.08] bg-white py-2 pl-9 pr-3 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-white/[0.1] dark:bg-[#17171a]"
          />
        </div>

        <div className="flex rounded-xl border border-black/[0.08] bg-white p-0.5 dark:border-white/[0.1] dark:bg-[#17171a]">
          {(["all", "active", "inactive"] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === value
                  ? "bg-accent-500/10 text-accent-600 dark:text-accent-300"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex animate-slide-up flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-500/25 bg-accent-500/[0.07] px-4 py-3">
          <p className="text-sm font-medium text-[var(--ink-primary)]">
            {selectedIds.length} school{selectedIds.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            {canBulkActivate && (
              <Button
                variant="secondary"
                onClick={() =>
                  setPendingAction({ ids: selectedSchools.filter((s) => !s.is_active).map((s) => s.id), activate: true })
                }
              >
                <CheckCircle2 size={15} strokeWidth={1.9} />
                Reactivate
              </Button>
            )}
            {canBulkDeactivate && (
              <Button
                variant="danger"
                onClick={() =>
                  setPendingAction({ ids: selectedSchools.filter((s) => s.is_active).map((s) => s.id), activate: false })
                }
              >
                <XCircle size={15} strokeWidth={1.9} />
                Deactivate selected
              </Button>
            )}
          </div>
        </div>
      )}

      {schoolsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[196px] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white py-8 dark:border-white/[0.08] dark:bg-[#17171a]">
          <EmptyState
            icon={Building2}
            title={schools.length === 0 ? "No schools yet" : "No schools match your filters"}
            description={
              schools.length === 0
                ? "Create the first school to start onboarding admins and staff."
                : "Try a different search term or status filter."
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Checkbox checked={allSelected} onChange={toggleAll} id="select-all-schools" />
            <label htmlFor="select-all-schools" className="cursor-pointer text-xs text-[var(--ink-muted)]">
              Select all {filtered.length} shown
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((school, i) => (
              <SchoolCard
                key={school.id}
                school={school}
                index={i}
                isSelected={selectedIds.includes(school.id)}
                onToggle={() => toggleOne(school.id)}
                onOpen={() => navigate(`/dashboard/super-admin/schools/${school.id}`)}
                onSetActive={(activate) => setPendingAction({ ids: [school.id], activate })}
              />
            ))}
          </div>
        </>
      )}

      <ImpactDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.activate ? "Reactivate schools?" : "Deactivate schools?"}
        message={
          pendingAction?.activate
            ? "These schools will become accessible again, and every account switched off by this deactivation will regain login access. Accounts suspended individually stay suspended."
            : "Every user in these schools — principal, teachers, accountant, drivers, extracurricular staff, students and parents — will lose login access until the school is reactivated."
        }
        schoolNames={pendingSchools.map((s) => s.name)}
        affectedSchools={impactQuery.data?.affectedSchools ?? 0}
        affectedUsers={impactQuery.data?.affectedUsers ?? 0}
        confirmLabel={pendingAction?.activate ? "Reactivate" : "Deactivate"}
        intent={pendingAction?.activate ? "primary" : "danger"}
        isPreviewLoading={impactQuery.isLoading}
        isLoading={setActiveMutation.isPending}
        onConfirm={() => pendingAction && setActiveMutation.mutate(pendingAction)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function SchoolCard({
  school,
  index,
  isSelected,
  onToggle,
  onOpen,
  onSetActive,
}: {
  school: PlatformSchool;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onSetActive: (activate: boolean) => void;
}) {
  const location = [school.city, school.district, school.state].filter(Boolean).join(", ");

  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className={`group animate-slide-up rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-[#17171a] ${
          isSelected
            ? "border-accent-400 ring-2 ring-accent-500/20 dark:border-accent-600"
            : "border-black/[0.06] hover:border-accent-200 dark:border-white/[0.08] dark:hover:border-accent-800"
        } ${school.is_active ? "" : "opacity-[0.86]"}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onChange={onToggle}
          aria-label={`Select ${school.name}`}
          className="mt-1 shrink-0"
        />
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none"
        >
          <SchoolLogo src={school.logo_url} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--ink-primary)] group-hover:text-accent-600 dark:group-hover:text-accent-400">
              {school.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
              {school.code}
              {location && ` · ${location}`}
            </p>
          </div>
        </button>
        <StatusPill isActive={school.is_active} cascaded={school.cascade_suspended} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-black/[0.02] p-2.5 dark:bg-white/[0.03]">
        <MiniStat icon={GraduationCap} label="Students" value={school.counts.students} />
        <MiniStat icon={Users} label="Teachers" value={school.counts.teachers} />
        <MiniStat icon={Building2} label="Classes" value={school.counts.classes} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-[var(--ink-muted)]">
          {school.admins.length > 0
            ? `Admin: ${school.admins.map((a) => a.full_name).join(", ")}`
            : "No School Admin assigned"}
        </p>
        <button
          type="button"
          onClick={() => onSetActive(!school.is_active)}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            school.is_active
              ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              : "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          }`}
        >
          {school.is_active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="min-w-0 text-center">
      <div className="flex items-center justify-center gap-1 text-[var(--ink-muted)]">
        <Icon size={12} strokeWidth={1.9} />
        <span className="truncate text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-semibold text-[var(--ink-primary)]">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
