import { api } from "@/lib/axios";
import { supabase } from "@/lib/supabaseClient";
import { PaginatedResult } from "@/types/admin.types";
import {
  Announcement,
  AnnouncementListItem,
  AttachmentFileType,
  CreateAnnouncementInput,
  NewAttachmentInput,
  UpdateAnnouncementInput,
} from "@/types/announcement.types";

const ATTACHMENT_BUCKET = "announcement-attachments";

function detectFileType(file: File): AttachmentFileType {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

export async function fetchAnnouncements(params: {
  search?: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<AnnouncementListItem>> {
  const { data } = await api.get("/announcements", { params });
  return data.data;
}

export async function fetchAnnouncement(id: string): Promise<Announcement> {
  const { data } = await api.get(`/announcements/${id}`);
  return data.data;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const { data } = await api.post("/announcements", input);
  return data.data;
}

export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<Announcement> {
  const { data } = await api.patch(`/announcements/${id}`, input);
  return data.data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await api.delete(`/announcements/${id}`);
}

/**
 * Uploads straight to the private `announcement-attachments` bucket (same
 * direct-to-storage pattern as studentDocuments.service.ts), keyed under the
 * announcement's own (client-generated) id so this can happen *before* the
 * announcement itself has been created.
 */
export async function uploadAttachment(schoolId: string, announcementId: string, file: File): Promise<NewAttachmentInput> {
  const path = `${schoolId}/${announcementId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
  if (error) throw error;
  return { storage_path: path, file_name: file.name, file_type: detectFileType(file), file_size: file.size };
}

/** Cleans up a file the user attached-then-removed before the announcement was saved. */
export async function removeUploadedAttachment(storagePath: string): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
}
