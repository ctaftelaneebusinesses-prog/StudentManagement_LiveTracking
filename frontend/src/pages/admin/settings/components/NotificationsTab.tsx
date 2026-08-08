import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsCard } from "./SettingsCard";
import { SettingsTabSkeleton } from "./SettingsSkeleton";
import { ErrorState } from "@/pages/admin/dashboard/components/states/ErrorState";
import * as schoolService from "@/services/admin/school.service";
import { EmailSettings, NotificationSettings } from "@/types/admin.types";

function EmailSettingsCard({ current }: { current: EmailSettings | undefined }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      host: current?.host ?? "",
      port: current?.port ?? 587,
      user: current?.user ?? "",
      password: current?.password ?? "",
      from: current?.from ?? "",
      secure: current?.secure ?? false,
    },
  });

  const mutation = useMutation({
    mutationFn: schoolService.updateEmailSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });

  return (
    <SettingsCard title="Email Settings" subtitle="Per-school SMTP override — falls back to the platform default when left blank">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => mutation.mutate({ ...values, port: Number(values.port) }))}
      >
        <Input label="SMTP host" placeholder="smtp.example.com" {...register("host")} />
        <Input label="Port" type="number" {...register("port")} />
        <Input label="SMTP username" {...register("user")} />
        <Input label="SMTP password" type="password" {...register("password")} />
        <Input label="From address" placeholder="School <no-reply@school.com>" {...register("from")} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-[var(--ink-secondary)]">
          <input type="checkbox" {...register("secure")} /> Use TLS (secure)
        </label>
        {mutation.isSuccess && <p className="sm:col-span-2 text-sm text-[var(--delta-good)]">Email settings saved.</p>}
        {mutation.isError && <p className="sm:col-span-2 text-sm text-[var(--delta-bad)]">Failed to save email settings.</p>}
        <Button type="submit" className="sm:col-span-2 sm:w-fit" isLoading={isSubmitting || mutation.isPending}>
          Save email settings
        </Button>
      </form>
    </SettingsCard>
  );
}

function NotificationSettingsCard({ current }: { current: NotificationSettings | undefined }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: schoolService.updateNotificationSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "school"] }),
  });
  const emailEnabled = current?.emailEnabled ?? true;

  return (
    <SettingsCard title="Notification Settings" subtitle="Controls whether notification emails are sent for this school">
      <div className="flex items-center justify-between rounded-xl border border-black/[0.06] p-4 dark:border-white/[0.08]">
        <div>
          <p className="text-sm font-medium text-[var(--ink-primary)]">Email notifications</p>
          <p className="text-xs text-[var(--ink-muted)]">Send an email alongside every in-app notification (attendance, homework, announcements, etc.)</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          onClick={() => mutation.mutate({ emailEnabled: !emailEnabled })}
          disabled={mutation.isPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${emailEnabled ? "bg-accent-600" : "bg-black/20 dark:bg-white/20"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${emailEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </SettingsCard>
  );
}

export function NotificationsTab() {
  const query = useQuery({ queryKey: ["admin", "school"], queryFn: schoolService.fetchMySchool });

  if (query.isLoading) return <SettingsTabSkeleton cards={2} rows={4} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />;
  }

  const settings = query.data?.settings ?? {};

  return (
    <div className="animate-fade-in space-y-6">
      <NotificationSettingsCard current={settings.notifications as NotificationSettings | undefined} />
      <EmailSettingsCard current={settings.email as EmailSettings | undefined} />
    </div>
  );
}
