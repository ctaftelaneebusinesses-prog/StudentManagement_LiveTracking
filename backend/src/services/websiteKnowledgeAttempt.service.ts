import { supabaseAdmin } from "../config/supabase";
import { logger } from "../config/logger";
import { ApiError } from "../utils/ApiError";
import { QuizRole } from "../config/websiteKnowledge";
import { getSettings, QuestionOption } from "./websiteKnowledgeQuestion.service";
import { resolveNotificationRecipients, notifyCompletionOnce } from "./websiteKnowledgeNotify.service";

interface SnapshotQuestion {
  question_id: string;
  question_text: string;
  category: string | null;
  options: QuestionOption[];
  correct_option: string;
  explanation: string | null;
}

interface AttemptRow {
  id: string;
  user_id: string;
  school_id: string | null;
  role_name: QuizRole;
  set_id: string | null;
  attempt_number: number;
  questions_snapshot: SnapshotQuestion[];
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  percentage: number | null;
  passed: boolean | null;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
}

const ATTEMPT_SELECT =
  "id, user_id, school_id, role_name, set_id, attempt_number, questions_snapshot, total_questions, correct_answers, wrong_answers, percentage, passed, status, started_at, completed_at";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Strips correct_option/explanation from the snapshot while a quiz is in
 * progress, so the client can never read the answer key mid-attempt.
 *
 * `category` is withheld too: every seeded question asks which ERP section
 * does X, and the category IS that section ("Timetable", "Fees", ...), so
 * showing it alongside the question hands over the correct option verbatim.
 * It comes back once the attempt is completed, where it usefully labels the
 * question in the review/history views.
 */
function sanitizeSnapshot(questions: SnapshotQuestion[]) {
  return questions.map((q) => ({
    question_id: q.question_id,
    question_text: q.question_text,
    options: q.options,
  }));
}

function toClientAttempt(attempt: AttemptRow, revealAnswers: boolean) {
  return {
    ...attempt,
    questions_snapshot: revealAnswers ? attempt.questions_snapshot : sanitizeSnapshot(attempt.questions_snapshot),
  };
}

/** Picks the least-recently-used active set for this user+role, cycling through every set before any repeats (spec §13: "Do not repeatedly show the same question set until all available sets have been used"). */
async function pickNextSet(userId: string, roleName: QuizRole) {
  const { data: sets, error: setsError } = await supabaseAdmin
    .from("website_knowledge_question_sets")
    .select("id, set_number")
    .eq("role_name", roleName)
    .eq("is_active", true)
    .order("set_number");
  if (setsError) throw ApiError.internal(setsError.message);
  if (!sets || sets.length === 0) throw ApiError.notFound(`No active question sets configured for role "${roleName}"`);

  const { data: history, error: historyError } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .select("set_id, completed_at")
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  if (historyError) throw ApiError.internal(historyError.message);

  const lastUsedAt = new Map<string, string>();
  for (const h of history ?? []) {
    if (h.set_id && !lastUsedAt.has(h.set_id)) lastUsedAt.set(h.set_id, h.completed_at as string);
  }

  const neverUsed = sets.filter((s) => !lastUsedAt.has(s.id));
  if (neverUsed.length > 0) return neverUsed[0];

  return sets.slice().sort((a, b) => (lastUsedAt.get(a.id)! < lastUsedAt.get(b.id)! ? -1 : 1))[0];
}

export async function getAttemptNumber(userId: string, roleName: QuizRole): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .eq("status", "completed");
  if (error) throw ApiError.internal(error.message);
  return (count ?? 0) + 1;
}

/** Resumes an in-progress attempt if one exists, else starts a fresh one against the next round-robin set. */
export async function startAttempt(schoolId: string | null, userId: string, roleName: QuizRole) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .select(ATTEMPT_SELECT)
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .eq("status", "in_progress")
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);
  if (existing) return toClientAttempt(existing as unknown as AttemptRow, false);

  const settings = await getSettings();
  const set = await pickNextSet(userId, roleName);

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("website_knowledge_question_set_items")
    .select(`order_index, questions:website_knowledge_questions!inner(id, question_text, category, options, correct_option, explanation, is_active)`)
    .eq("set_id", set.id)
    .eq("questions.is_active", true)
    .order("order_index");
  if (itemsError) throw ApiError.internal(itemsError.message);

  type ItemRow = { questions: { id: string; question_text: string; category: string | null; options: QuestionOption[]; correct_option: string; explanation: string | null } };
  const questions = ((items ?? []) as unknown as ItemRow[]).map((i) => i.questions);
  if (questions.length === 0) throw ApiError.notFound("This question set has no active questions");

  // Randomize question order (spec §5), then take up to the configured
  // count — if the set has fewer questions than settings.question_count,
  // every available question is used (content grows via the admin UI).
  const orderedQuestions = shuffle(questions).slice(0, settings.question_count);

  const snapshot: SnapshotQuestion[] = orderedQuestions.map((q) => ({
    question_id: q.id,
    question_text: q.question_text,
    category: q.category,
    options: shuffle(q.options), // randomize answer option order (spec §5)
    correct_option: q.correct_option,
    explanation: q.explanation,
  }));

  const attemptNumber = await getAttemptNumber(userId, roleName);

  const { data, error } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .insert({
      user_id: userId,
      school_id: schoolId,
      role_name: roleName,
      set_id: set.id,
      attempt_number: attemptNumber,
      questions_snapshot: snapshot,
      total_questions: snapshot.length,
      status: "in_progress",
    })
    .select(ATTEMPT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return toClientAttempt(data as unknown as AttemptRow, false);
}

async function getOwnAttempt(attemptId: string, userId: string): Promise<AttemptRow> {
  const { data, error } = await supabaseAdmin.from("website_knowledge_attempts").select(ATTEMPT_SELECT).eq("id", attemptId).maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Attempt not found");
  const attempt = data as unknown as AttemptRow;
  if (attempt.user_id !== userId) throw ApiError.forbidden("This is not your attempt");
  return attempt;
}

export async function submitAnswer(attemptId: string, userId: string, questionId: string, selectedOption: string) {
  const attempt = await getOwnAttempt(attemptId, userId);
  if (attempt.status !== "in_progress") throw ApiError.badRequest("This attempt has already been completed");

  const question = attempt.questions_snapshot.find((q) => q.question_id === questionId);
  if (!question) throw ApiError.badRequest("This question is not part of the current attempt");

  const isCorrect = question.correct_option === selectedOption;

  const { error } = await supabaseAdmin
    .from("website_knowledge_attempt_answers")
    .upsert(
      { attempt_id: attemptId, question_id: questionId, selected_option: selectedOption, is_correct: isCorrect },
      { onConflict: "attempt_id,question_id" }
    );
  if (error) throw ApiError.internal(error.message);

  return { question_id: questionId, is_correct: isCorrect };
}

function generateCertificateNumber(schoolId: string | null): string {
  const scope = schoolId ? schoolId.slice(0, 8) : "PLATFORM";
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `WK-${scope}-${ts}${rand}`;
}

async function upsertCertificateIfPassed(attempt: AttemptRow, score: number, percentage: number) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("website_knowledge_certificates")
    .select("id, percentage")
    .eq("user_id", attempt.user_id)
    .eq("role_name", attempt.role_name)
    .maybeSingle();
  if (existingError) throw ApiError.internal(existingError.message);

  if (!existing) {
    const { error } = await supabaseAdmin.from("website_knowledge_certificates").insert({
      certificate_number: generateCertificateNumber(attempt.school_id),
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      school_id: attempt.school_id,
      role_name: attempt.role_name,
      score,
      percentage,
    });
    if (error) throw ApiError.internal(error.message);
    return;
  }

  // Retain the best result rather than minting a second certificate (spec §36).
  if (percentage > Number(existing.percentage)) {
    const { error } = await supabaseAdmin
      .from("website_knowledge_certificates")
      .update({ attempt_id: attempt.id, score, percentage, issued_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw ApiError.internal(error.message);
  }
}

const ROLE_LABELS: Record<QuizRole, string> = {
  student: "Student",
  teacher: "Teacher",
  principal: "Principal",
  school_admin: "School Admin",
  accountant: "Accountant",
  driver: "Driver",
  extracurricular_staff: "Extracurricular Staff",
};

export async function completeAttempt(attemptId: string, userId: string) {
  const attempt = await getOwnAttempt(attemptId, userId);
  if (attempt.status !== "in_progress") throw ApiError.badRequest("This attempt has already been completed");

  const { data: answers, error: answersError } = await supabaseAdmin
    .from("website_knowledge_attempt_answers")
    .select("question_id, is_correct")
    .eq("attempt_id", attemptId);
  if (answersError) throw ApiError.internal(answersError.message);

  const answerMap = new Map((answers ?? []).map((a) => [a.question_id as string, Boolean(a.is_correct)]));
  const total = attempt.total_questions;
  const correct = attempt.questions_snapshot.filter((q) => answerMap.get(q.question_id) === true).length;
  const wrong = total - correct;
  const percentage = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;

  const settings = await getSettings();
  const passed = percentage >= settings.passing_percentage;

  const { data: updated, error } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .update({
      correct_answers: correct,
      wrong_answers: wrong,
      percentage,
      passed,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .select(ATTEMPT_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  const completedAttempt = updated as unknown as AttemptRow;

  if (passed) {
    await upsertCertificateIfPassed(completedAttempt, correct, percentage);
  }

  // The attempt is already scored and persisted above, so the fan-out to the
  // next link in the hierarchy is best-effort: a notification failure must
  // never turn a finished assessment into a failed submission the student
  // can't get past (that is exactly what a missing notifications_type_check
  // value did before 074). Log and move on.
  try {
    const recipients = await resolveNotificationRecipients(attempt.role_name, userId, attempt.school_id);
    if (recipients.length > 0) {
      const { data: actor } = await supabaseAdmin.from("users").select("full_name").eq("id", userId).maybeSingle();
      const roleLabel = ROLE_LABELS[attempt.role_name];
      const actorName = (actor?.full_name as string | undefined) ?? "A user";
      await notifyCompletionOnce(attemptId, recipients, attempt.school_id, userId, {
        title: "Website Knowledge Assessment completed",
        message: `${actorName} (${roleLabel}) completed the Website Knowledge Assessment with a score of ${percentage}%.`,
        metadata: { attempt_id: attemptId, role_name: attempt.role_name, percentage, passed },
      });
    }
  } catch (err) {
    logger.error({ err, attemptId, userId }, "Website Knowledge completion notification failed");
  }

  return toClientAttempt(completedAttempt, true);
}

export async function listMyAttempts(userId: string, roleName: QuizRole) {
  const { data, error } = await supabaseAdmin
    .from("website_knowledge_attempts")
    .select(
      "id, attempt_number, total_questions, correct_answers, wrong_answers, percentage, passed, status, started_at, completed_at, set_id, website_knowledge_question_sets(name, set_number)"
    )
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .order("started_at", { ascending: false });
  if (error) throw ApiError.internal(error.message);
  return data;
}

export async function getAttemptDetail(attemptId: string, userId: string) {
  const attempt = await getOwnAttempt(attemptId, userId);

  const { data: answers, error } = await supabaseAdmin
    .from("website_knowledge_attempt_answers")
    .select("question_id, selected_option, is_correct")
    .eq("attempt_id", attemptId);
  if (error) throw ApiError.internal(error.message);

  return { ...toClientAttempt(attempt, attempt.status === "completed"), answers: answers ?? [] };
}

export async function getMyCertificate(userId: string, roleName: QuizRole) {
  const { data, error } = await supabaseAdmin
    .from("website_knowledge_certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  return data;
}
