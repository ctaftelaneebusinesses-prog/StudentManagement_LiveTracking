import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { escapeOrFilterValue } from "../utils/searchFilter";
import { assignStaffToActivity } from "./extracurricularStaff.service";

const ACTIVITY_SELECT = "id, school_id, name, staff_title, category, is_custom, is_active, created_by, created_at";

interface ListActivitiesFilters {
  search?: string;
  is_active?: boolean;
  page: number;
  pageSize: number;
}

/**
 * Activities are either a global preset (school_id null, visible to every
 * school) or a school's own custom entry. Rather than a single `.or()` that
 * also has to fold in a search `.or()` — chaining two `.or()` calls on the
 * same postgrest-js query is fragile / undocumented behavior — this runs the
 * global and school-scoped queries separately (each with its own plain
 * eq/ilike filters) and merges + paginates in application code. The total
 * row count per school is small (16 global presets + a handful of customs),
 * so in-memory pagination is cheap and avoids that footgun entirely.
 */
export async function listActivities(schoolId: string, filters: ListActivitiesFilters) {
  let globalQuery = supabaseAdmin.from("activities").select(ACTIVITY_SELECT).is("school_id", null);
  let schoolQuery = supabaseAdmin.from("activities").select(ACTIVITY_SELECT).eq("school_id", schoolId);

  if (filters.is_active !== undefined) {
    globalQuery = globalQuery.eq("is_active", filters.is_active);
    schoolQuery = schoolQuery.eq("is_active", filters.is_active);
  }

  if (filters.search) {
    const pattern = escapeOrFilterValue(`%${filters.search}%`);
    const searchFilter = `name.ilike.${pattern},staff_title.ilike.${pattern}`;
    globalQuery = globalQuery.or(searchFilter);
    schoolQuery = schoolQuery.or(searchFilter);
  }

  const [{ data: globalRows, error: globalError }, { data: schoolRows, error: schoolError }] = await Promise.all([
    globalQuery,
    schoolQuery,
  ]);
  if (globalError) throw ApiError.internal(globalError.message);
  if (schoolError) throw ApiError.internal(schoolError.message);

  const merged = [...(globalRows ?? []), ...(schoolRows ?? [])].sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );

  const total = merged.length;
  const from = (filters.page - 1) * filters.pageSize;
  const pageRows = merged.slice(from, from + filters.pageSize);

  const activityIds = pageRows.map((a) => a.id as string);
  const statusCounts = new Map<string, { pending: number; completed: number }>();
  if (activityIds.length > 0) {
    // Assignments are always school-specific (a staff member belongs to one
    // school) even when the activity itself is a global preset — so this
    // filters by school_id regardless of the activity row's own school_id.
    const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
      .from("extracurricular_staff_activities")
      .select("activity_id, status")
      .eq("school_id", schoolId)
      .in("activity_id", activityIds);
    if (assignmentError) throw ApiError.internal(assignmentError.message);

    for (const row of assignmentRows ?? []) {
      const activityId = row.activity_id as string;
      const counts = statusCounts.get(activityId) ?? { pending: 0, completed: 0 };
      if (row.status === "completed") counts.completed += 1;
      else counts.pending += 1;
      statusCounts.set(activityId, counts);
    }
  }

  const items = pageRows.map((a) => ({
    ...a,
    assignedPendingCount: statusCounts.get(a.id as string)?.pending ?? 0,
    assignedCompletedCount: statusCounts.get(a.id as string)?.completed ?? 0,
  }));

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function createActivity(
  schoolId: string,
  actorId: string,
  input: { name: string; staff_title: string; category?: string; staff_ids?: string[] }
) {
  const { data, error } = await supabaseAdmin
    .from("activities")
    .insert({
      school_id: schoolId,
      name: input.name,
      staff_title: input.staff_title,
      category: input.category,
      is_custom: true,
      created_by: actorId,
    })
    .select(ACTIVITY_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") throw ApiError.conflict("An activity with this name already exists for your school");
    throw ApiError.internal(error.message);
  }

  if (input.staff_ids && input.staff_ids.length > 0) {
    await assignStaffToActivity(schoolId, data.id, input.staff_ids, actorId);
  }

  return data;
}

export async function updateActivity(schoolId: string, id: string, actorId: string, patch: Record<string, unknown>) {
  const { staff_ids, ...activityPatch } = patch as { staff_ids?: string[]; [key: string]: unknown };

  // Scoped to school_id so a school can only ever edit its own custom rows,
  // never a global preset — school_id null never matches this .eq().
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("activities")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (!existing) throw ApiError.notFound("Activity not found");

  if (Object.keys(activityPatch).length > 0) {
    const { error } = await supabaseAdmin.from("activities").update(activityPatch).eq("id", id).eq("school_id", schoolId);
    if (error) {
      if (error.code === "23505") throw ApiError.conflict("An activity with this name already exists for your school");
      throw ApiError.internal(error.message);
    }
  }

  if (staff_ids !== undefined) {
    await assignStaffToActivity(schoolId, id, staff_ids, actorId);
  }

  const { data, error } = await supabaseAdmin.from("activities").select(ACTIVITY_SELECT).eq("id", id).eq("school_id", schoolId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Activity not found");
  return data;
}

export async function deactivateActivity(schoolId: string, id: string, actorId: string) {
  return updateActivity(schoolId, id, actorId, { is_active: false });
}
