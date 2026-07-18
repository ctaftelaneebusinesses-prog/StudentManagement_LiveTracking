import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";
import { RoleName } from "@/types/auth.types";

interface ProtectedRouteProps {
  /** If provided, only these roles may access the nested routes. */
  allowedRoles?: RoleName[];
}

/**
 * Guards nested routes behind an authenticated session and, optionally, a
 * role allow-list. This is a UX convenience only — the real authorization
 * boundary is Postgres RLS (client) and requireAuth/requireRole (backend),
 * so a client-side bypass here can never expose data the DB wouldn't allow.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, roleNames, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Spinner label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Checked against ALL roles the user holds (roleNames), not just their
  // single primary role — a user can be granted access via any assigned role.
  if (allowedRoles && !allowedRoles.some((role) => roleNames.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
