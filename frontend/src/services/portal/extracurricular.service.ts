import { api } from "@/lib/axios";
import { PortalExtracurricularOverview } from "@/types/portalExtracurricular.types";

export async function fetchExtracurricularOverview(studentId: string): Promise<PortalExtracurricularOverview> {
  const { data } = await api.get(`/students/${studentId}/extracurricular`);
  return data.data;
}
