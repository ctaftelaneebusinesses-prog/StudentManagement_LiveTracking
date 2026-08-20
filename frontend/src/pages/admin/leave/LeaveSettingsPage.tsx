import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import * as schoolService from "@/services/admin/school.service";
import { LeaveTypeLimits, RoleLeavePolicy } from "@/services/admin/school.service";
import { getApiErrorMessage } from "@/lib/axios";

const DEFAULT_LIMITS: LeaveTypeLimits = { casual: 12, sick: 10, other: 5 };
const DEFAULT_POLICY: RoleLeavePolicy = { teacher: DEFAULT_LIMITS, principal: DEFAULT_LIMITS };

function totalOf(limits: LeaveTypeLimits): number {
  return limits.casual + limits.sick + limits.other;
}

function RolePolicyForm({
  title,
  subtitle,
  limits,
  onChange,
}: {
  title: string;
  subtitle: string;
  limits: LeaveTypeLimits;
  onChange: (limits: LeaveTypeLimits) => void;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>
        </div>
        <span className="text-sm font-semibold text-[var(--ink-primary)]">{totalOf(limits)} days / year</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Casual leave"
          type="number"
          min={0}
          value={limits.casual}
          onChange={(e) => onChange({ ...limits, casual: Number(e.target.value) || 0 })}
        />
        <Input
          label="Sick leave"
          type="number"
          min={0}
          value={limits.sick}
          onChange={(e) => onChange({ ...limits, sick: Number(e.target.value) || 0 })}
        />
        <Input
          label="Other leave"
          type="number"
          min={0}
          value={limits.other}
          onChange={(e) => onChange({ ...limits, other: Number(e.target.value) || 0 })}
        />
      </div>
    </Card>
  );
}

export function LeaveSettingsPage() {
  const queryClient = useQueryClient();
  const { data: school } = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });
  const [policy, setPolicy] = useState<RoleLeavePolicy>(DEFAULT_POLICY);

  useEffect(() => {
    const stored = school?.settings?.leavePolicy as Partial<RoleLeavePolicy> | undefined;
    if (stored?.teacher || stored?.principal) {
      setPolicy({
        teacher: { ...DEFAULT_LIMITS, ...stored.teacher },
        principal: { ...DEFAULT_LIMITS, ...stored.principal },
      });
    }
  }, [school]);

  const mutation = useMutation({
    mutationFn: schoolService.updateLeavePolicy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Leave Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Set the yearly leave limit for Principal and Teachers. These values automatically reflect in each person's leave balance.
        </p>
      </div>

      <RolePolicyForm
        title="Principal"
        subtitle="Yearly leave limit for the principal"
        limits={policy.principal}
        onChange={(limits) => setPolicy((prev) => ({ ...prev, principal: limits }))}
      />
      <RolePolicyForm
        title="Teachers"
        subtitle="Yearly leave limit for all teachers"
        limits={policy.teacher}
        onChange={(limits) => setPolicy((prev) => ({ ...prev, teacher: limits }))}
      />

      <Button isLoading={mutation.isPending} onClick={() => mutation.mutate(policy)}>
        Save leave settings
      </Button>
      {mutation.isSuccess && <p className="text-sm text-[var(--delta-good)]">Leave settings saved.</p>}
      {mutation.isError && (
        <p className="text-sm text-[var(--delta-bad)]">{getApiErrorMessage(mutation.error, "Failed to save leave settings.")}</p>
      )}
    </div>
  );
}
