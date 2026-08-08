import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bus,
  Building2,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import * as superAdminService from "@/services/superAdmin.service";
import { useSchoolStore } from "@/store/schoolStore";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, StatusPill } from "./components/PageHeader";
import { ImpactDialog } from "./components/ImpactDialog";

/** §20 — full detail for one school, with the quick actions the spec lists. */
export function SuperAdminSchoolOverviewPage() {
  const { schoolId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setSelectedSchoolId = useSchoolStore((s) => s.setSelectedSchoolId);
  const [pendingActivate, setPendingActivate] = useState<boolean | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["super-admin", "school", schoolId],
    queryFn: () => superAdminService.fetchSchoolOverview(schoolId),
    enabled: Boolean(schoolId),
  });

  const impactQuery = useQuery({
    queryKey: ["super-admin", "schools", "impact", [schoolId]],
    queryFn: () => superAdminService.previewSchoolsImpact([schoolId]),
    enabled: pendingActivate !== null,
  });

  const setActiveMutation = useMutation({
    mutationFn: (activate: boolean) => superAdminService.setSchoolsActive([schoolId], activate),
    onSuccess: (result, activate) => {
      toast.success(
        `School ${activate ? "reactivated" : "deactivated"} — ${result.usersAffected} account${
          result.usersAffected === 1 ? "" : "s"
        } affected.`
      );
      setPendingActivate(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin"] });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't update the school"),
  });

  /**
   * "View Users" drops into the school-level console targeting this school —
   * setting the selector's school makes every school-scoped request carry it
   * (see lib/axios.ts), so the Users page opens on the right tenant.
   */
  function openInSchoolConsole(path: string) {
    setSelectedSchoolId(schoolId);
    navigate(path);
  }

  if (overviewQuery.isLoading) {
    return (
      <div>
        <PageHeader title="School Overview" />
        <Skeleton className="mb-4 h-[168px] rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div>
        <PageHeader title="School Overview" />
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load this school. It may have been removed.
        </div>
      </div>
    );
  }

  const { school, counts, admins, principal } = overviewQuery.data;
  const location = [school.address, school.city, school.district, school.state, school.pin_code, school.country]
    .filter(Boolean)
    .join(", ");

  const statCards = [
    { label: "Students", value: counts.students, icon: GraduationCap },
    { label: "Teachers", value: counts.teachers, icon: Users },
    { label: "Classes", value: counts.classes, icon: Building2 },
    { label: "Sections", value: counts.sections, icon: Building2 },
    { label: "Accountants", value: counts.accountants, icon: Wallet },
    { label: "Drivers", value: counts.drivers, icon: Bus },
    { label: "EC Staff", value: counts.extracurricularStaff, icon: Sparkles },
    { label: "Total Users", value: counts.totalUsers, icon: UserCheck },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/dashboard/super-admin/schools")}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        All schools
      </button>

      <PageHeader
        title={school.name}
        subtitle={`Code ${school.code}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => openInSchoolConsole("/dashboard/admin/users")}>
              View users
            </Button>
            <Button variant="secondary" onClick={() => openInSchoolConsole(`/dashboard/admin/schools/${schoolId}`)}>
              Edit details
            </Button>
            <Button
              variant={school.is_active ? "danger" : "primary"}
              onClick={() => setPendingActivate(!school.is_active)}
            >
              {school.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </>
        }
      />

      <section className="mb-5 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/[0.08] dark:bg-[#17171a]">
        <div className="flex flex-wrap items-start gap-4">
          <SchoolLogo src={school.logo_url} size="lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--ink-primary)]">{school.name}</h2>
              <StatusPill isActive={school.is_active} cascaded={school.cascade_suspended} />
            </div>
            {location && (
              <p className="flex items-start gap-1.5 text-sm text-[var(--ink-muted)]">
                <MapPin size={14} strokeWidth={1.9} className="mt-0.5 shrink-0" />
                <span>{location}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--ink-muted)]">
              {school.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} strokeWidth={1.9} />
                  {school.phone}
                </span>
              )}
              {school.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} strokeWidth={1.9} />
                  {school.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08] sm:grid-cols-2">
          <PersonBlock
            title="School Admins"
            people={admins.map((a) => ({ id: a.id, name: a.full_name, detail: a.email, isActive: a.is_active }))}
            emptyLabel="No School Admin assigned"
            onSelect={() => navigate("/dashboard/super-admin/school-admins")}
          />
          <PersonBlock
            title="Principal"
            people={
              principal
                ? [{ id: principal.id, name: principal.full_name, detail: principal.email, isActive: principal.is_active }]
                : []
            }
            emptyLabel={school.principal_name ? `${school.principal_name} (no account)` : "No principal account"}
            onSelect={() => openInSchoolConsole("/dashboard/admin/users")}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            style={{ animationDelay: `${i * 35}ms` }}
            className="animate-slide-up rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
          >
            <div className="flex items-center gap-2 text-[var(--ink-muted)]">
              <card.icon size={14} strokeWidth={1.9} />
              <span className="truncate text-[11px] font-medium uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-[var(--ink-primary)]">
              {card.value.toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </section>

      <ImpactDialog
        isOpen={pendingActivate !== null}
        title={pendingActivate ? "Reactivate this school?" : "Deactivate this school?"}
        message={
          pendingActivate
            ? `${school.name} will become accessible again, and every account switched off by its deactivation will regain login access. Accounts suspended individually stay suspended.`
            : `Every user in ${school.name} — principal, teachers, accountant, drivers, extracurricular staff, students and parents — will lose login access until the school is reactivated.`
        }
        schoolNames={[school.name]}
        affectedSchools={impactQuery.data?.affectedSchools ?? 0}
        affectedUsers={impactQuery.data?.affectedUsers ?? 0}
        confirmLabel={pendingActivate ? "Reactivate" : "Deactivate"}
        intent={pendingActivate ? "primary" : "danger"}
        isPreviewLoading={impactQuery.isLoading}
        isLoading={setActiveMutation.isPending}
        onConfirm={() => pendingActivate !== null && setActiveMutation.mutate(pendingActivate)}
        onCancel={() => setPendingActivate(null)}
      />
    </div>
  );
}

function PersonBlock({
  title,
  people,
  emptyLabel,
  onSelect,
}: {
  title: string;
  people: { id: string; name: string; detail: string; isActive: boolean }[];
  emptyLabel: string;
  onSelect: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">{title}</p>
      {people.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={onSelect}
                className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              >
                <Avatar name={person.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--ink-primary)]">{person.name}</span>
                  <span className="block truncate text-xs text-[var(--ink-muted)]">{person.detail}</span>
                </span>
                <StatusPill isActive={person.isActive} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
