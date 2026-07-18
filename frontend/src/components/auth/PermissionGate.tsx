import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only if the signed-in user holds the given permission code. */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermissions();
  return <>{can(permission) ? children : fallback}</>;
}
