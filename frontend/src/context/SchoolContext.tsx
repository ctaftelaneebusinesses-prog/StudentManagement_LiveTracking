import { createContext, ReactNode, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolStore } from "@/store/schoolStore";
import * as schoolService from "@/services/admin/school.service";
import { School } from "@/types/admin.types";

interface SchoolContextValue {
  schools: School[];
  selectedSchool: School;
  setSelectedSchoolId: (id: string) => void;
  /** Whether a school switcher should be shown at all — false for the common single-school case. */
  canSwitchSchools: boolean;
}

export const SchoolContext = createContext<SchoolContextValue | undefined>(undefined);

const EMPTY_SCHOOL: School = {
  id: "",
  name: "",
  code: "",
  branch_name: null,
  principal_name: null,
  address: null,
  phone: null,
  alternate_phone: null,
  email: null,
  city: null,
  district: null,
  state: null,
  pin_code: null,
  country: null,
  logo_url: null,
  settings: {},
  is_active: true,
};

export function SchoolProvider({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  /**
   * Who gets a school switcher, and over which schools, changed with
   * 066_super_admin_multi_school.sql: a super_admin switches across every
   * school, a school_admin only across the ones assigned to them, and
   * everyone else has exactly one.
   *
   * The list comes from GET /schools/assigned, which scopes the response to
   * the caller server-side — so this never has to know the difference, and a
   * school_admin is never even told that other schools exist (§17).
   */
  const canSwitch = hasPermission("schools.view_assigned");
  const { selectedSchoolId, setSelectedSchoolId } = useSchoolStore();

  // canSwitch users get their school list from /schools/assigned, which is
  // strictly more complete than /schools/me — a platform-level super_admin
  // account (users.school_id null, e.g. one created purely to run the
  // Platform Console) has no "own school" at all, so /schools/me 400s for
  // them. Only fetch it for the single-school case that actually needs it.
  const myOwnSchoolQuery = useQuery({
    queryKey: ["admin", "school", "me"],
    queryFn: schoolService.fetchMySchool,
    enabled: !canSwitch,
  });

  const assignedSchoolsQuery = useQuery({
    queryKey: ["admin", "schools", "assigned"],
    queryFn: schoolService.listAssignedSchools,
    enabled: canSwitch,
  });

  const schools = useMemo<School[]>(() => {
    if (canSwitch) return assignedSchoolsQuery.data ?? [];
    return myOwnSchoolQuery.data ? [myOwnSchoolQuery.data] : [];
  }, [canSwitch, assignedSchoolsQuery.data, myOwnSchoolQuery.data]);

  // First-ever session (nothing in localStorage yet) — default to the
  // caller's home school (single-school users), or their first accessible
  // school for a canSwitch user. That second branch matters specifically for
  // a home-school-less super_admin: without it, selectedSchoolId stays empty
  // forever (myOwnSchoolQuery never runs for them), so every school-scoped
  // request in the Admin Console silently has no school attached and 400s —
  // this was previously the actual cause behind "School Console looks broken".
  useEffect(() => {
    if (selectedSchoolId) return;
    if (canSwitch && schools.length > 0) {
      setSelectedSchoolId(schools[0].id);
    } else if (!canSwitch && myOwnSchoolQuery.data) {
      setSelectedSchoolId(myOwnSchoolQuery.data.id);
    }
  }, [selectedSchoolId, canSwitch, schools, myOwnSchoolQuery.data, setSelectedSchoolId]);

  // Self-heal a stale/invalid persisted selection (e.g. leftover demo data
  // from an earlier build, or a school the account lost access to) once the
  // real school list has loaded — otherwise every request keeps sending an id
  // that matches no accessible school, and the backend 403s/400s on it.
  useEffect(() => {
    if (!selectedSchoolId || schools.length === 0) return;
    if (!schools.some((s) => s.id === selectedSchoolId)) {
      setSelectedSchoolId((myOwnSchoolQuery.data ?? schools[0]).id);
    }
  }, [selectedSchoolId, schools, myOwnSchoolQuery.data, setSelectedSchoolId]);

  const selectedSchool =
    schools.find((s) => s.id === selectedSchoolId) ?? myOwnSchoolQuery.data ?? schools[0] ?? EMPTY_SCHOOL;

  const value = useMemo<SchoolContextValue>(
    () => ({
      schools,
      selectedSchool,
      setSelectedSchoolId,
      canSwitchSchools: canSwitch && schools.length > 1,
    }),
    [schools, selectedSchool, setSelectedSchoolId, canSwitch]
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}
