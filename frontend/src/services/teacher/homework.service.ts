import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { HomeworkItem } from "@/types/teacher.types";

export async function fetchHomework(classId: string): Promise<HomeworkItem[]> {
  const { data } = await api.get("/homework", { params: { classId } });
  return data.data;
}

export interface CreateHomeworkInput {
  class_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  due_date: string;
  attachment_url?: string;
}

export async function createHomework(input: CreateHomeworkInput): Promise<HomeworkItem> {
  const { data } = await api.post("/homework", input);
  return data.data;
}

export async function updateHomework(id: string, patch: Partial<CreateHomeworkInput>): Promise<HomeworkItem> {
  const { data } = await api.patch(`/homework/${id}`, patch);
  return data.data;
}

export async function deleteHomework(id: string): Promise<void> {
  await api.delete(`/homework/${id}`);
}

/**
 * Uploads a homework attachment to the public `homework-attachments` bucket,
 * keyed `{schoolId}/{teacherId}/{filename}` so the
 * homework_attachments_write_staff_or_teacher storage policy (folder[1] must
 * equal the caller's school_id) allows it — mirrors
 * services/profile.service.ts::uploadAvatar's upload-then-getPublicUrl flow.
 */
export async function uploadHomeworkAttachment(schoolId: string, teacherId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${schoolId}/${teacherId}/${timestamp}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("homework-attachments")
    .upload(path, file, { upsert: false, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("homework-attachments").getPublicUrl(path);
  return data.publicUrl;
}
