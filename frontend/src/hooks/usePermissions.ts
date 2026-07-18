import { useAuth } from "./useAuth";

/** Convenience accessor for permission-gated rendering/logic. */
export function usePermissions() {
  const { permissions, hasPermission } = useAuth();
  return { permissions, can: hasPermission };
}
