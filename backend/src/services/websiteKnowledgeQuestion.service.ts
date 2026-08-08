import { supabaseAdmin } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import { QuizRole } from "../config/websiteKnowledge";

export interface QuestionOption {
  key: string;
  text: string;
}

interface QuestionRow {
  id: string;
  role_name: QuizRole;
  question_text: string;
  options: QuestionOption[];
  correct_option: string;
  explanation: string | null;
  category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface QuestionSetRow {
  id: string;
  role_name: QuizRole;
  set_number: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

const QUESTION_SELECT =
  "id, role_name, question_text, options, correct_option, explanation, category, is_active, created_by, created_at, updated_at";
const SET_SELECT = "id, role_name, set_number, name, is_active, created_at";

// ---------------------------------------------------------------------------
// Question bank (Super Admin only — assessment.manage_questions)
// ---------------------------------------------------------------------------

export async function listQuestions(filters: { role_name?: string; category?: string; is_active?: string; search?: string }) {
  let query = supabaseAdmin.from("website_knowledge_questions").select(QUESTION_SELECT).order("created_at", { ascending: false });
  if (filters.role_name) query = query.eq("role_name", filters.role_name);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.is_active) query = query.eq("is_active", filters.is_active === "true");
  if (filters.search) query = query.ilike("question_text", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  return data as unknown as QuestionRow[];
}

function validateOptions(options: QuestionOption[], correctOption: string) {
  if (!Array.isArray(options) || options.length !== 4) {
    throw ApiError.badRequest("A question must have exactly 4 options");
  }
  const keys = new Set(options.map((o) => o.key));
  if (keys.size !== 4) throw ApiError.badRequest("Option keys must be unique");
  if (!keys.has(correctOption)) throw ApiError.badRequest("correct_option must match one of the option keys");
}

export async function createQuestion(
  createdBy: string,
  input: {
    role_name: QuizRole;
    question_text: string;
    options: QuestionOption[];
    correct_option: string;
    explanation?: string;
    category?: string;
  }
) {
  validateOptions(input.options, input.correct_option);

  const { data, error } = await supabaseAdmin
    .from("website_knowledge_questions")
    .insert({
      role_name: input.role_name,
      question_text: input.question_text,
      options: input.options,
      correct_option: input.correct_option,
      explanation: input.explanation ?? null,
      category: input.category ?? null,
      created_by: createdBy,
    })
    .select(QUESTION_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  return data as unknown as QuestionRow;
}

export async function updateQuestion(
  id: string,
  patch: Partial<{
    question_text: string;
    options: QuestionOption[];
    correct_option: string;
    explanation: string | null;
    category: string | null;
    is_active: boolean;
  }>
) {
  if (patch.options || patch.correct_option) {
    const { data: existing } = await supabaseAdmin
      .from("website_knowledge_questions")
      .select("options, correct_option")
      .eq("id", id)
      .maybeSingle();
    const options = patch.options ?? (existing?.options as QuestionOption[] | undefined) ?? [];
    const correctOption = patch.correct_option ?? existing?.correct_option ?? "";
    validateOptions(options, correctOption);
  }

  const { data, error } = await supabaseAdmin
    .from("website_knowledge_questions")
    .update(patch)
    .eq("id", id)
    .select(QUESTION_SELECT)
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Question not found");
  return data as unknown as QuestionRow;
}

export async function deleteQuestion(id: string) {
  const { error } = await supabaseAdmin.from("website_knowledge_questions").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Question sets
// ---------------------------------------------------------------------------

export async function listQuestionSets(roleName?: string) {
  let query = supabaseAdmin.from("website_knowledge_question_sets").select(SET_SELECT).order("role_name").order("set_number");
  if (roleName) query = query.eq("role_name", roleName);
  const { data, error } = await query;
  if (error) throw ApiError.internal(error.message);
  const sets = (data ?? []) as unknown as QuestionSetRow[];

  const { data: itemCounts, error: countError } = await supabaseAdmin
    .from("website_knowledge_question_set_items")
    .select("set_id");
  if (countError) throw ApiError.internal(countError.message);
  const counts = new Map<string, number>();
  for (const row of itemCounts ?? []) {
    const setId = row.set_id as string;
    counts.set(setId, (counts.get(setId) ?? 0) + 1);
  }

  return sets.map((s) => ({ ...s, question_count: counts.get(s.id) ?? 0 }));
}

export async function createQuestionSet(input: { role_name: QuizRole; set_number: number; name: string }) {
  const { data, error } = await supabaseAdmin
    .from("website_knowledge_question_sets")
    .insert({ role_name: input.role_name, set_number: input.set_number, name: input.name })
    .select(SET_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw ApiError.conflict(`Set number ${input.set_number} already exists for ${input.role_name}`);
    throw ApiError.internal(error.message);
  }
  return data as unknown as QuestionSetRow;
}

export async function updateQuestionSet(id: string, patch: Partial<{ name: string; is_active: boolean }>) {
  const { data, error } = await supabaseAdmin.from("website_knowledge_question_sets").update(patch).eq("id", id).select(SET_SELECT).single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Question set not found");
  return data as unknown as QuestionSetRow;
}

export async function deleteQuestionSet(id: string) {
  const { error } = await supabaseAdmin.from("website_knowledge_question_sets").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function getQuestionSetItems(setId: string) {
  const { data, error } = await supabaseAdmin
    .from("website_knowledge_question_set_items")
    .select(`id, order_index, question_id, questions:website_knowledge_questions(${QUESTION_SELECT})`)
    .eq("set_id", setId)
    .order("order_index");
  if (error) throw ApiError.internal(error.message);
  return data as unknown as { id: string; order_index: number; question_id: string; questions: QuestionRow }[];
}

export async function addQuestionToSet(setId: string, questionId: string, orderIndex?: number) {
  let order = orderIndex;
  if (order === undefined) {
    const { count } = await supabaseAdmin
      .from("website_knowledge_question_set_items")
      .select("id", { count: "exact", head: true })
      .eq("set_id", setId);
    order = count ?? 0;
  }
  const { error } = await supabaseAdmin
    .from("website_knowledge_question_set_items")
    .insert({ set_id: setId, question_id: questionId, order_index: order });
  if (error) {
    if (error.code === "23505") throw ApiError.conflict("This question is already in the set");
    throw ApiError.internal(error.message);
  }
}

export async function removeQuestionFromSet(setId: string, questionId: string) {
  const { error } = await supabaseAdmin
    .from("website_knowledge_question_set_items")
    .delete()
    .eq("set_id", setId)
    .eq("question_id", questionId);
  if (error) throw ApiError.internal(error.message);
}

// ---------------------------------------------------------------------------
// Platform-wide settings (singleton row — Super Admin only)
// ---------------------------------------------------------------------------

export interface WebsiteKnowledgeSettings {
  id: 1;
  question_count: number;
  passing_percentage: number;
  updated_by: string | null;
  updated_at: string;
}

export async function getSettings(): Promise<WebsiteKnowledgeSettings> {
  const { data, error } = await supabaseAdmin.from("website_knowledge_settings").select("*").eq("id", 1).single();
  if (error) throw ApiError.internal(error.message);
  return data as unknown as WebsiteKnowledgeSettings;
}

export async function updateSettings(updatedBy: string, patch: Partial<{ question_count: number; passing_percentage: number }>) {
  const { data, error } = await supabaseAdmin
    .from("website_knowledge_settings")
    .update({ ...patch, updated_by: updatedBy })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw ApiError.internal(error.message);
  return data as unknown as WebsiteKnowledgeSettings;
}
