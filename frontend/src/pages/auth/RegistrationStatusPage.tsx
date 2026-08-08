import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Clock3, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/axios";
import { Button } from "@/components/ui/Button";
import { ROLE_HOME_ROUTE } from "@/utils/roles";
import { AuthSplitLayout, AuthGlassCard } from "./components/AuthSplitLayout";

interface ApprovalDetail {
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  reviewer_notes: string | null;
  reviewer_name: string | null;
}

const STATUS_COPY: Record<"pending" | "rejected", { title: string; message: string }> = {
  pending: {
    title: "Pending approval",
    message: "Your account is awaiting approval. Please wait until your registration request is approved.",
  },
  rejected: {
    title: "Registration rejected",
    message: "Your registration request has been rejected. Please contact your school administrator for more information.",
  },
};

/**
 * Reachable by an authenticated-but-not-yet-approved user — ProtectedRoute
 * redirects here whenever user.status isn't 'approved' (see ProtectedRoute.tsx),
 * so this route sits outside that guard to avoid an immediate redirect loop.
 */
export function RegistrationStatusPage() {
  const { user, logout, isLoading } = useAuth();
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);

  useEffect(() => {
    if (!user || user.status === "approved") return;
    // GET /auth/me is reachable even for a pending/rejected account (see
    // requireAuthAllowUnapproved) specifically so this page can show who
    // reviewed it, if anyone has yet — best-effort, falls back to just the
    // bare status already known from useAuth() if this fails.
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (data.data.approval) setDetail(data.data.approval);
      })
      .catch(() => undefined);
  }, [user]);

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.status || user.status === "approved") {
    return <Navigate to={ROLE_HOME_ROUTE[user.roles.name]} replace />;
  }

  const copy = STATUS_COPY[user.status];
  const Icon = user.status === "pending" ? Clock3 : XCircle;
  const iconColor = user.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400";

  return (
    <AuthSplitLayout>
      <div className="mx-auto max-w-md">
        <AuthGlassCard className="text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${iconColor}`}>
            <Icon className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm text-slate-300">{copy.message}</p>

          {detail?.reviewer_name && (
            <p className="mt-3 text-xs text-slate-400">
              {user.status === "pending" ? "Assigned to" : "Reviewed by"} <span className="font-medium text-slate-300">{detail.reviewer_name}</span>
            </p>
          )}
          {detail?.reviewer_notes && (
            <p className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 text-left text-xs text-slate-300">{detail.reviewer_notes}</p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Status updates automatically — check back after your school reviews your request.
          </div>

          <Button variant="secondary" className="mt-6 w-full" onClick={() => logout()}>
            Sign out
          </Button>
        </AuthGlassCard>
      </div>
    </AuthSplitLayout>
  );
}
