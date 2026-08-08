import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Bus,
  GraduationCap,
  Layers,
  Mail,
  MapPin,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { useToast } from "@/components/ui/Toast";
import { ChartCard } from "@/pages/admin/dashboard/components/ChartCard";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import { useSchoolStore } from "@/store/schoolStore";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/axios";
import * as schoolService from "@/services/admin/school.service";

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-black/[0.04] text-[var(--ink-muted)] dark:bg-white/[0.06]">
        <Icon size={15} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-[var(--ink-primary)]">{value}</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="flex-1 rounded-2xl border border-black/[0.06] bg-white px-5 py-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink-primary)]">{value}</p>
    </div>
  );
}

export function SchoolProfilePage() {
  const { id } = useParams<{ id: string }>();
  const schoolId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const setSelectedSchoolId = useSchoolStore((s) => s.setSelectedSchoolId);
  // school_admin/super_admin can edit a school's full profile (any school).
  // Principal can only update their own school's logo (school.manage_settings),
  // never the rest of the profile or any other school — everyone else can't
  // even reach this route.
  const { hasPermission } = useAuth();
  const canManageSchools = hasPermission("platform.manage_schools");
  const canEditLogo = canManageSchools || hasPermission("school.manage_settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const schoolQuery = useQuery({
    queryKey: ["admin", "schools", schoolId],
    queryFn: () => schoolService.getSchoolById(schoolId),
    enabled: !!schoolId,
  });
  const statsQuery = useQuery({
    queryKey: ["admin", "schools", schoolId, "stats"],
    queryFn: () => schoolService.fetchSchoolProfileStats(schoolId),
    enabled: !!schoolId,
  });

  if (schoolQuery.isError) {
    return <ErrorState message="This school couldn't be found." onRetry={() => schoolQuery.refetch()} />;
  }

  const school = schoolQuery.data;
  const stats = statsQuery.data;

  /** Switches the global school context to this school, then jumps into the existing (single-school) admin page for it. */
  function viewAs(path: string) {
    setSelectedSchoolId(schoolId);
    navigate(path);
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !schoolId) return;
    setIsUploadingLogo(true);
    try {
      if (canManageSchools) {
        // May be viewing any school (not necessarily the actor's own), so
        // upload + PATCH that specific school by id.
        const logo_url = await schoolService.uploadSchoolLogoFor(schoolId, file);
        await schoolService.updateSchoolById(schoolId, { logo_url });
      } else {
        // Principal: assertCanViewSchool guarantees this page is always
        // their own school, so PATCHing /schools/me is safe and correct.
        await schoolService.uploadSchoolLogo(schoolId, file);
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "schools"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "school"] });
      toast.success("School logo updated.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update school logo."));
    } finally {
      setIsUploadingLogo(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="!p-2" onClick={() => navigate("/dashboard/admin/schools")} title="Back">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{school ? school.name : "Loading…"}</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{school?.code ?? "—"}</p>
        </div>
        {school && (
          <Badge variant={school.is_active ? "success" : "neutral"} className="ml-auto">
            {school.is_active ? "Active" : "Inactive"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatPill label="Students" value={stats?.totalStudents ?? 0} icon={GraduationCap} />
        <StatPill label="Teachers" value={stats?.totalTeachers ?? 0} icon={Users} />
        <StatPill label="Drivers" value={stats?.totalDrivers ?? 0} icon={Bus} />
        <StatPill label="Classes" value={stats?.totalClasses ?? 0} icon={Layers} />
        <StatPill label="Sections" value={stats?.totalSections ?? 0} icon={Layers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="School Information" className="lg:col-span-2">
          {school ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex items-center gap-3 sm:col-span-2">
                <SchoolLogo src={school.logo_url} size="lg" />
                {canEditLogo && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-3 !py-1.5 text-xs"
                      isLoading={isUploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change logo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </div>
                )}
              </div>
              <InfoRow icon={Layers} label="Branch" value={school.branch_name ?? "—"} />
              <InfoRow icon={Users} label="Principal" value={school.principal_name ?? "—"} />
              <InfoRow icon={Mail} label="Email" value={school.email ?? "—"} />
              <InfoRow icon={Phone} label="Phone" value={school.phone ?? school.alternate_phone ?? "—"} />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={[school.address, school.city, school.district, school.state, school.pin_code, school.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              />
            </div>
          ) : (
            <div className="h-32 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.04]" />
          )}
        </ChartCard>

        <ChartCard title="Quick Actions">
          <div className="space-y-2">
            {canManageSchools && (
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate(`/dashboard/admin/schools?edit=${schoolId}`)}>
                <Settings size={15} className="mr-2" />
                Edit school
              </Button>
            )}
            <Button variant="secondary" className="w-full justify-start" onClick={() => viewAs("/dashboard/admin/users")}>
              <Users size={15} className="mr-2" />
              View Users
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => viewAs("/dashboard/admin/classes")}>
              <Layers size={15} className="mr-2" />
              View Classes
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => viewAs("/dashboard/admin/reports")}>
              <GraduationCap size={15} className="mr-2" />
              View Reports
            </Button>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
