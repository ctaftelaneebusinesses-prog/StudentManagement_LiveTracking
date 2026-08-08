import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/hooks/useSchool";
import { SchoolsPage } from "@/pages/admin/SchoolsPage";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Mounted at /dashboard/admin/schools for school_admin, super_admin, AND
 * principal.
 *
 * Since 066_super_admin_multi_school.sql only super_admin holds
 * platform.manage_schools, so only they get the full multi-school list here
 * (SchoolsPage unconditionally calls listSchools()/fetchPlatformStats(), both
 * of which 403 without it). Platform-wide school administration proper lives
 * in the Platform Console at /dashboard/super-admin/schools; this page stays
 * as the school profile/CRUD surface.
 *
 * school_admin and principal both land on the profile of whichever school is
 * currently selected — for a principal that's their only school, and for a
 * school_admin it follows the school selector across their assigned schools.
 * Neither is ever shown a list that could reveal a school they don't manage.
 */
export function SchoolManagementEntry() {
  const { hasPermission } = useAuth();
  const { selectedSchool } = useSchool();

  if (hasPermission("platform.manage_schools")) return <SchoolsPage />;
  if (!selectedSchool.id) return <Spinner label="Loading..." />;
  return <Navigate to={`/dashboard/admin/schools/${selectedSchool.id}`} replace />;
}
