import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { EvaluatedPaper } from "@/types/portal.types";

export async function fetchEvaluatedPapers(studentId: string): Promise<EvaluatedPaper[]> {
  const { data } = await api.get(`/students/${studentId}/evaluated-papers`);
  return data.data;
}

/** Uploads straight to the private `evaluated-papers` bucket, keyed `{schoolId}/{studentId}/{filename}` (checked server-side in evaluatedPaper.service.ts::addPaper). */
export async function uploadEvaluatedPaperFile(schoolId: string, studentId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${schoolId}/${studentId}/${timestamp}-${safeName}`;

  const { error } = await supabase.storage.from("evaluated-papers").upload(path, file, { upsert: false, cacheControl: "3600" });
  if (error) throw error;

  return path;
}

export interface AddEvaluatedPaperInput {
  exam_id: string;
  subject_id: string;
  file_name: string;
  storage_path: string;
  notes?: string;
}

export async function addEvaluatedPaper(studentId: string, input: AddEvaluatedPaperInput): Promise<EvaluatedPaper> {
  const { data } = await api.post(`/students/${studentId}/evaluated-papers`, input);
  return data.data;
}

export async function deleteEvaluatedPaper(studentId: string, paperId: string): Promise<void> {
  await api.delete(`/students/${studentId}/evaluated-papers/${paperId}`);
}
