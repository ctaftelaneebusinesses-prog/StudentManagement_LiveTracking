/**
 * Mirrors the fixed `public.roles` seed data (database/schema.sql +
 * database/migrations/002_rbac_permissions.sql). These ids are stable
 * reference data, never reassigned, so it's safe to hardcode them here
 * rather than querying the roles table on every request.
 */
export const ROLE_ID = {
  SCHOOL_ADMIN: 1,
  PRINCIPAL: 2,
  TEACHER: 3,
  STUDENT: 5,
  DRIVER: 6,
  SUPER_ADMIN: 7,
  SUPPORT_STAFF: 8,
  ACCOUNTANT: 9,
  EXTRACURRICULAR_STAFF: 10,
} as const;
