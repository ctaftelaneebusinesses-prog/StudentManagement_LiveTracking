export type AudienceType =
  | "all"
  | "teachers"
  | "students"
  | "classes"
  | "principal"
  | "specific_teachers"
  | "accountants"
  | "extracurricular_staff"
  | "specific_extracurricular_staff";
export type AttachmentFileType = "pdf" | "image" | "document";
export type AnnouncementStatus = "scheduled" | "published";

export interface AnnouncementAttachment {
  id: string;
  file_name: string;
  file_type: AttachmentFileType;
  storage_path: string;
  file_size: number | null;
  created_at: string;
  url: string | null;
}

export interface AnnouncementClassRef {
  id: string;
  name: string | null;
  section: string | null;
}

export interface AnnouncementTeacherRef {
  id: string;
  full_name: string | null;
}

export interface AnnouncementEcStaffRef {
  id: string;
  full_name: string | null;
}

export interface AnnouncementListItem {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  publish_at: string;
  notified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: AnnouncementStatus;
  attachmentCount: number;
  audienceSummary: string;
}

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  publish_at: string;
  notified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: AnnouncementStatus;
  classes: AnnouncementClassRef[];
  teachers: AnnouncementTeacherRef[];
  ecStaff: AnnouncementEcStaffRef[];
  attachments: AnnouncementAttachment[];
}

export interface NewAttachmentInput {
  storage_path: string;
  file_name: string;
  file_type: AttachmentFileType;
  file_size?: number;
}

export interface CreateAnnouncementInput {
  id: string;
  title: string;
  body: string;
  audience_type: AudienceType;
  class_ids?: string[];
  teacher_ids?: string[];
  ec_staff_ids?: string[];
  publish_at?: string;
  attachments?: NewAttachmentInput[];
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  audience_type?: AudienceType;
  class_ids?: string[];
  teacher_ids?: string[];
  ec_staff_ids?: string[];
  publish_at?: string;
  new_attachments?: NewAttachmentInput[];
  remove_attachment_ids?: string[];
}

export const AUDIENCE_LABEL: Record<AudienceType, string> = {
  all: "All",
  teachers: "Teachers",
  students: "Students",
  classes: "Selected classes",
  principal: "Principal",
  specific_teachers: "Specific teachers",
  accountants: "Accountants",
  extracurricular_staff: "Extracurricular Staff",
  specific_extracurricular_staff: "Specific staff",
};
