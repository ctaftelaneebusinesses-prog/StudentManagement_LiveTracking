import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { ROLE_LABEL } from "@/utils/roles";

/**
 * Generic landing page shown right after login for every role. Portal-specific
 * dashboards (attendance summaries, GPS map, gradebook, etc.) replace this
 * once each module is built and approved.
 */
export function DashboardHome() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {user?.full_name ?? "there"}
        </h1>
        <p className="text-sm text-slate-500">
          You are signed in as {user ? ROLE_LABEL[user.roles.name] : "—"}.
        </p>
      </div>

      <Card>
        <p className="text-sm text-slate-600">
          This is the foundation dashboard shell. Attendance, marks, homework,
          reports, notifications, and live GPS tracking modules will appear
          here once built.
        </p>
      </Card>
    </div>
  );
}
