/**
 * The 7 roles that take the Website Knowledge quiz (see spec MODULE 1).
 * super_admin deliberately excluded — it only ever gets read-only global
 * reporting access (MODULE 2), never takes the quiz itself.
 */
export const QUIZ_ROLES = [
  "student",
  "teacher",
  "principal",
  "school_admin",
  "accountant",
  "driver",
  "extracurricular_staff",
] as const;

export type QuizRole = (typeof QUIZ_ROLES)[number];

export function isQuizRole(value: string): value is QuizRole {
  return (QUIZ_ROLES as readonly string[]).includes(value);
}

/** Super Admin-configurable question count options (spec §3). */
export const QUESTION_COUNT_OPTIONS = [20, 30, 50] as const;

/** Super Admin-configurable passing percentage options (spec §9). */
export const PASSING_PERCENTAGE_OPTIONS = [70, 75, 80, 85, 90] as const;

/**
 * Resolves which single role a caller takes the quiz "as" — a user's
 * req.user.roleName (primary role) if it's quiz-eligible, else the first
 * quiz-eligible role among all of req.user.roles. The quiz, its attempts,
 * and its certificate are all scoped to exactly one role per user; someone
 * holding two quiz-eligible roles (rare) takes it as their primary one.
 */
export function resolveQuizRole(roleName: string, roles: string[]): QuizRole | null {
  if (isQuizRole(roleName)) return roleName;
  const match = roles.find(isQuizRole);
  return match ?? null;
}
