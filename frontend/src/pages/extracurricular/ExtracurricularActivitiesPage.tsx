import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/axios";
import * as portalService from "@/services/extracurricularPortal.service";

export function ExtracurricularActivitiesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["extracurricular", "activities"],
    queryFn: portalService.fetchMyActivities,
  });

  const completeMutation = useMutation({
    mutationFn: portalService.markActivityCompleted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extracurricular", "activities"] });
      toast.success("Activity marked as completed.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to mark activity as completed.")),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">My Activities</h1>
        <p className="text-sm text-[var(--ink-muted)]">Activities you've been assigned to teach, managed by your school admin.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            title="No activities assigned yet"
            description="Once the admin assigns you to an activity, it will appear here."
            icon={Sparkles}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((activity) => (
            <Card key={activity.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm">
                  <Sparkles size={18} strokeWidth={1.75} />
                </span>
                <Badge variant={activity.status === "completed" ? "success" : "warning"}>
                  {activity.status === "completed" ? "Completed" : "Assigned"}
                </Badge>
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--ink-primary)]">{activity.name}</h2>
                <p className="text-sm text-[var(--ink-muted)]">{activity.staff_title}</p>
                {activity.assigned_by_name && (
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">Assigned by {activity.assigned_by_name}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activity.category && <Badge variant="info">{activity.category}</Badge>}
                {activity.is_custom && <Badge variant="warning">Custom</Badge>}
              </div>
              {activity.status !== "completed" && (
                <Button
                  variant="secondary"
                  className="w-full !py-1.5 text-xs"
                  isLoading={completeMutation.isPending && completeMutation.variables === activity.id}
                  onClick={() => completeMutation.mutate(activity.id)}
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  Mark Complete
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
