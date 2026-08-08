import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mail, MailX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import * as notificationService from "@/services/notification.service";
import { EmergencyAlertInput } from "@/services/notification.service";
import { getApiErrorMessage } from "@/lib/axios";

const TITLE_MAX = 120;
const MESSAGE_MAX = 1000;

export function EmergencyAlertsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingValues, setPendingValues] = useState<EmergencyAlertInput | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<EmergencyAlertInput>({
    defaultValues: { title: "", message: "" },
  });

  const historyQuery = useQuery({
    queryKey: ["admin", "notifications", "school"],
    queryFn: notificationService.fetchSchoolNotifications,
  });

  const sendMutation = useMutation({
    mutationFn: notificationService.sendEmergencyAlert,
    onSuccess: () => {
      reset();
      setPendingValues(null);
      toast.success("Emergency alert sent to the whole school");
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications", "school"] });
    },
    onError: () => setPendingValues(null),
  });

  const alerts = (historyQuery.data ?? []).filter((n) => n.type === "emergency");
  const titleValue = watch("title");
  const messageValue = watch("message");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertTriangle size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Emergency Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sends an immediate, critical-priority notification and email to every user in the school. Use only for
            genuine emergencies (closures, safety incidents, etc.).
          </p>
        </div>
      </div>

      <Card className="max-w-xl space-y-4">
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => setPendingValues(values))}
        >
          <div>
            <Input
              label="Title"
              maxLength={TITLE_MAX}
              error={errors.title?.message}
              {...register("title", { required: "Title is required" })}
              placeholder="e.g. School closed today"
            />
            <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
              {(titleValue ?? "").length}/{TITLE_MAX}
            </p>
          </div>

          <div>
            <Textarea
              label="Message"
              rows={5}
              maxLength={MESSAGE_MAX}
              error={errors.message?.message}
              placeholder="Details for students and staff…"
              {...register("message", { required: "Message is required" })}
            />
            <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
              {(messageValue ?? "").length}/{MESSAGE_MAX}
            </p>
          </div>

          <Button type="submit" variant="danger" className="w-full" isLoading={isSubmitting}>
            Send emergency alert
          </Button>
        </form>
      </Card>

      <div className="max-w-xl space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent alerts</h2>
        {historyQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : alerts.length === 0 ? (
          <Card>
            <EmptyState title="No emergency alerts sent yet" icon={AlertTriangle} />
          </Card>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900 dark:text-white">{alert.title}</p>
                  <span
                    title={alert.email_sent_at ? `Email sent ${new Date(alert.email_sent_at).toLocaleString()}` : "Email not sent"}
                    className="flex shrink-0 items-center gap-1 text-xs text-slate-400 dark:text-slate-500"
                  >
                    {alert.email_sent_at ? <Mail size={14} strokeWidth={1.75} /> : <MailX size={14} strokeWidth={1.75} />}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{alert.message}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(alert.created_at).toLocaleString()}</p>
              </Card>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!pendingValues}
        title="Send emergency alert"
        message={`This immediately notifies and emails every user in the school with "${pendingValues?.title}". This cannot be undone or recalled. Continue?`}
        confirmLabel="Send now"
        isLoading={sendMutation.isPending}
        onConfirm={() => pendingValues && sendMutation.mutate(pendingValues)}
        onCancel={() => setPendingValues(null)}
      />

      {sendMutation.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(sendMutation.error, "Failed to send alert. Please try again.")}
        </p>
      )}
    </div>
  );
}
